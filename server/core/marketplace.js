// EFIKO — Marketplace pillar (V2 R5). Institutions list courses/packs for sale; learners buy
// them and gain a purchase record (access marker). Checkout goes through the pluggable payment
// adapter (payments.js) — a mock demo by default, Flutterwave-seamed for going live.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';
import { settlePayment, verifyPayment } from './payments.js';
import { v4StartMomoCharge, v4StartCardCharge, v4GetCharge, v4CreateCustomer, v4FindCustomerByEmail } from './paymentsV4.js';

const LISTINGS = 'market_listings';
const PURCHASES = 'market_purchases';
const EARNINGS = 'market_earnings'; // one ledger entry per creator sale
const PAYOUT_DETAILS = 'market_payout_details'; // one per creator: where to send payouts
const CHARGES = 'market_charges'; // pending v4 checkout charges (reference -> buyer + listing)
const FW_CUSTOMERS = 'fw_customers'; // EFIKO userId -> Flutterwave v4 customer id (create once)

// Get (or create + cache) this user's Flutterwave customer id. v4 rejects duplicate-email
// customers, so we reuse one per user; on a conflict we recover the id by lookup.
async function getOrCreateFwCustomer(userId, email) {
  const stored = await kvGet(FW_CUSTOMERS, userId);
  if (stored?.customerId) return { ok: true, id: stored.customerId };
  let c = await v4CreateCustomer(email);
  if (!c.ok && c.conflict) { const found = await v4FindCustomerByEmail(email); if (found) c = { ok: true, id: found }; }
  if (c.ok) await kvPut(FW_CUSTOMERS, userId, { userId, customerId: c.id });
  return c;
}

// Platform commission on creator sales (%). The creator keeps the rest.
const FEE_PCT = Math.min(90, Math.max(0, Number(process.env.MARKET_FEE_PCT) || 20));
export const platformFeePct = () => FEE_PCT;
const money2 = (n) => Math.round(Number(n) * 100) / 100;

// Supported pricing currencies (ISO 4217, all Flutterwave-payable). Keep in sync with
// src/currencies.js on the client.
const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'XOF', 'EGP', 'EUR', 'GBP'];

export async function createListing(ownerOrgId, { title, description, courseId = null, price = 0, currency = 'NGN' }) {
  if (!ownerOrgId) throw new Error('institution required');
  const t = String(title || '').trim();
  if (!t) throw new Error('title is required');
  const rec = {
    id: `l_${randomBytes(7).toString('hex')}`,
    ownerType: 'org', ownerId: ownerOrgId, ownerOrgId,
    title: t,
    description: String(description || '').trim().slice(0, 2000),
    courseId: courseId || null,
    price: Math.max(0, Math.round(Number(price) || 0)), // major units (e.g. naira)
    currency: CURRENCIES.includes(currency) ? currency : 'NGN',
    createdAt: Date.now()
  };
  await kvPut(LISTINGS, rec.id, rec);
  return rec;
}

// An individual creator (lecturer/expert/trainer) lists a product. Delivered via a link the
// buyer receives after purchase. Creator listings never gate EFIKO courses (no courseId), so
// no one can hijack access to content they don't own.
export async function createCreatorListing(user, { title, description, price = 0, currency = 'NGN', deliverableUrl = '' }) {
  if (!user?.userId) throw new Error('sign in required');
  const t = String(title || '').trim();
  if (!t) throw new Error('title is required');
  const rec = {
    id: `l_${randomBytes(7).toString('hex')}`,
    ownerType: 'creator', ownerId: user.userId, creatorName: user.name || 'Creator',
    title: t,
    description: String(description || '').trim().slice(0, 2000),
    courseId: null,
    deliverableUrl: String(deliverableUrl || '').trim().slice(0, 500),
    price: Math.max(0, Math.round(Number(price) || 0)),
    currency: CURRENCIES.includes(currency) ? currency : 'NGN',
    createdAt: Date.now()
  };
  await kvPut(LISTINGS, rec.id, rec);
  return rec;
}

export async function listCreatorListings(userId) {
  return (await kvAll(LISTINGS)).filter((l) => l.ownerType === 'creator' && l.ownerId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCreatorListing(userId, id) {
  const l = await kvGet(LISTINGS, id);
  if (!l || l.ownerType !== 'creator' || l.ownerId !== userId) return false;
  await kvDel(LISTINGS, id);
  return true;
}

export async function listListings() {
  // Strip the creator's delivery link — only buyers receive it (via their purchase record).
  return (await kvAll(LISTINGS)).map(({ deliverableUrl, ...l }) => l).sort((a, b) => b.createdAt - a.createdAt); // eslint-disable-line no-unused-vars
}

export async function listListingsByOrg(ownerOrgId) {
  return (await kvAll(LISTINGS)).filter((l) => l.ownerOrgId === ownerOrgId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getListing(id) {
  return id ? kvGet(LISTINGS, id) : null;
}

export async function deleteListing(ownerOrgId, id) {
  const l = await kvGet(LISTINGS, id);
  if (!l || l.ownerOrgId !== ownerOrgId) return false;
  await kvDel(LISTINGS, id);
  return true;
}

export async function listPurchases(userId) {
  return (await kvAll(PURCHASES)).filter((p) => p.userId === userId && p.status === 'paid');
}

export async function hasPurchased(userId, listingId) {
  return (await kvAll(PURCHASES)).some((p) => p.userId === userId && p.listingId === listingId && p.status === 'paid');
}

// --- Access-gating (entitlements) ---
// A course is "gated" if a paid listing links to it. Map courseId -> newest paid listing.
export async function gatedListingMap() {
  const listings = (await kvAll(LISTINGS)).filter((l) => l.courseId && l.price > 0).sort((a, b) => a.createdAt - b.createdAt);
  const m = new Map();
  for (const l of listings) m.set(l.courseId, l); // ascending sort => newest wins
  return m;
}

// Courses this user has bought (by the listing's linked courseId).
export async function purchasedCourseIds(userId) {
  if (!userId) return new Set();
  const purchases = await kvAll(PURCHASES);
  return new Set(purchases.filter((p) => p.userId === userId && p.status === 'paid' && p.courseId).map((p) => p.courseId));
}

// Access = course is not gated, OR the user has purchased it.
export async function hasCourseAccess(userId, courseId) {
  if (!(await gatedListingMap()).has(courseId)) return true;
  if (!userId) return false;
  return (await purchasedCourseIds(userId)).has(courseId);
}

async function recordPurchase(user, listing, pay) {
  const rec = {
    id: `pur_${randomBytes(8).toString('hex')}`,
    listingId: listing.id,
    courseId: listing.courseId,
    title: listing.title,
    userId: user.userId,
    amount: listing.price,
    currency: listing.currency,
    ...(listing.ownerType === 'creator' ? { deliverableUrl: listing.deliverableUrl || '', creatorName: listing.creatorName } : {}),
    status: pay.status || 'paid',
    ref: pay.ref,
    provider: pay.provider,
    createdAt: Date.now()
  };
  await kvPut(PURCHASES, rec.id, rec);
  // Revenue split: a creator sale credits the creator (net of the platform fee).
  if (listing.ownerType === 'creator' && listing.ownerId && (listing.price || 0) > 0) {
    const gross = listing.price;
    const fee = money2(gross * FEE_PCT / 100);
    await kvPut(EARNINGS, `earn_${rec.id}`, {
      id: `earn_${rec.id}`, purchaseId: rec.id, creatorId: listing.ownerId, listingId: listing.id, listingTitle: listing.title,
      buyerId: user.userId, gross, feePct: FEE_PCT, fee, net: money2(gross - fee), currency: listing.currency,
      status: 'pending', createdAt: Date.now()
    });
  }
  return rec;
}

// Creator earnings summary (per currency) + recent sales.
export async function getCreatorEarnings(userId) {
  const rows = (await kvAll(EARNINGS)).filter((e) => e.creatorId === userId);
  const byCurrency = {};
  for (const e of rows) {
    const c = (byCurrency[e.currency] ||= { gross: 0, net: 0, pending: 0, paid: 0, sales: 0 });
    c.gross = money2(c.gross + e.gross); c.net = money2(c.net + e.net); c.sales++;
    if (e.status === 'paid') c.paid = money2(c.paid + e.net); else c.pending = money2(c.pending + e.net);
  }
  return { feePct: FEE_PCT, byCurrency, sales: rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 25) };
}

// Request a payout — flags this creator's pending earnings as requested (actual disbursement
// is handled out-of-band via a Flutterwave transfer / manual payout). Returns requested totals.
export async function requestPayout(userId) {
  const rows = (await kvAll(EARNINGS)).filter((e) => e.creatorId === userId && e.status === 'pending');
  const requested = {};
  for (const e of rows) { e.status = 'requested'; e.requestedAt = Date.now(); await kvPut(EARNINGS, e.id, e); requested[e.currency] = money2((requested[e.currency] || 0) + e.net); }
  return { requested, count: rows.length };
}

// --- Operator payout administration ---
// Pending payout requests, grouped by creator + currency (earnings in status 'requested').
export async function listPayoutRequests() {
  const rows = (await kvAll(EARNINGS)).filter((e) => e.status === 'requested');
  const byKey = {};
  for (const e of rows) {
    const at = e.requestedAt || e.createdAt;
    const g = (byKey[`${e.creatorId}:${e.currency}`] ||= { creatorId: e.creatorId, currency: e.currency, net: 0, count: 0, oldestRequestedAt: at });
    g.net = money2(g.net + e.net); g.count++;
    if (at < g.oldestRequestedAt) g.oldestRequestedAt = at;
  }
  return Object.values(byKey).sort((a, b) => a.oldestRequestedAt - b.oldestRequestedAt);
}

// Mark a creator's requested earnings as paid (optionally scoped to one currency) once the
// operator has disbursed the transfer. `meta` (e.g. { payoutRef, transferId, method }) is
// stamped on each row for reconciliation. Returns how many rows and the net total settled.
export async function markPayoutPaid(creatorId, currency, meta = {}) {
  const rows = (await kvAll(EARNINGS)).filter((e) => e.creatorId === creatorId && e.status === 'requested' && (!currency || e.currency === currency));
  let net = 0;
  for (const e of rows) { e.status = 'paid'; e.paidAt = Date.now(); Object.assign(e, meta); await kvPut(EARNINGS, e.id, e); net = money2(net + e.net); }
  return { paid: rows.length, net: money2(net), currency: currency || null };
}

// Reconcile a payout by its reference after a Flutterwave webhook: mark the tagged earnings
// paid (SUCCESSFUL) or revert them to 'requested' (FAILED). Returns how many rows changed.
export async function reconcilePayout(payoutRef, ok) {
  const rows = (await kvAll(EARNINGS)).filter((e) => e.payoutRef === payoutRef);
  for (const e of rows) {
    e.status = ok ? 'paid' : 'requested';
    e.transferStatus = ok ? 'SUCCESSFUL' : 'FAILED';
    if (ok && !e.paidAt) e.paidAt = Date.now();
    await kvPut(EARNINGS, e.id, e);
  }
  return { updated: rows.length };
}

// --- Creator payout details: where to send this creator's money (multi-country) ---
// method 'bank'         -> bankCode + accountNumber (name auto-resolves at transfer time)
// method 'mobile_money' -> network + phone (msisdn) + first/last name
const maskTail = (n) => { const s = String(n || ''); return s.length > 4 ? `••••${s.slice(-4)}` : s; };

export async function savePayoutDetails(userId, d = {}) {
  if (!userId) throw new Error('sign in required');
  const method = d.method === 'mobile_money' ? 'mobile_money' : 'bank';
  const country = String(d.country || 'NG').toUpperCase();
  const currency = String(d.currency || 'NGN').toUpperCase();
  let rec;
  if (method === 'bank') {
    if (!d.bankCode || !d.accountNumber) throw new Error('bank and account number are required');
    rec = { userId, method, country, currency, bankCode: String(d.bankCode), bankName: d.bankName || '', accountNumber: String(d.accountNumber).trim(), accountName: d.accountName || '', updatedAt: Date.now() };
  } else {
    if (!d.network || !d.phone) throw new Error('mobile network and phone number are required');
    rec = { userId, method, country, currency, network: String(d.network), phone: String(d.phone).trim(), firstName: (d.firstName || '').trim(), lastName: (d.lastName || '').trim(), updatedAt: Date.now() };
  }
  await kvPut(PAYOUT_DETAILS, userId, rec);
  return getPayoutDetails(userId);
}

// Full record for internal use (transfers). Includes the raw account/phone number.
export async function getPayoutDetailsRaw(userId) {
  return kvGet(PAYOUT_DETAILS, userId);
}

// Masked view for the client (never leak the full account/phone number back).
export async function getPayoutDetails(userId) {
  const r = await getPayoutDetailsRaw(userId);
  if (!r) return null;
  const base = { method: r.method || 'bank', country: r.country, currency: r.currency };
  return (r.method === 'mobile_money')
    ? { ...base, network: r.network, phone: maskTail(r.phone), accountName: `${r.firstName || ''} ${r.lastName || ''}`.trim() }
    : { ...base, bankCode: r.bankCode, bankName: r.bankName, accountNumber: maskTail(r.accountNumber), accountName: r.accountName };
}

export async function hasPayoutDetails(userId) {
  return !!(await getPayoutDetailsRaw(userId));
}

// Free items + demo (mock) checkout. In live mode, paid items settle via purchaseVerified().
export async function purchase(user, listingId) {
  const l = await getListing(listingId);
  if (!l) throw new Error('listing not found');
  if (await hasPurchased(user.userId, listingId)) return { already: true };
  const pay = await settlePayment({ amount: l.price, currency: l.currency, ref: `${listingId}_${user.userId}` });
  return { purchase: await recordPurchase(user, l, pay) };
}

// --- Flutterwave v4 checkout (mobile money) ---
// Start a charge for a paid listing. Records a pending charge keyed by reference so we can
// confirm it later. Returns { reference, chargeId, status, nextAction } for the buyer to
// authorise on their phone.
export async function startV4Checkout(user, listingId, method) {
  const l = await getListing(listingId);
  if (!l) throw new Error('listing not found');
  if ((l.price || 0) <= 0) return { free: true, purchase: (await purchase(user, listingId)).purchase };
  if (await hasPurchased(user.userId, listingId)) return { already: true };
  const reference = `efikochg${randomBytes(10).toString('hex')}`;
  // Flutterwave requires a valid public https redirect URL (rejects localhost). Trust the
  // client's only if it qualifies, else fall back to the site base.
  const cand = method.redirectUrl || '';
  const redirectUrl = (/^https:\/\//.test(cand) && !/localhost|127\.0\.0\.1/.test(cand))
    ? cand : `${process.env.PUBLIC_BASE_URL || 'https://efikolearn.online'}/?market`;
  const cust = await getOrCreateFwCustomer(user.userId, user.email || `u_${user.userId}@efiko.app`);
  if (!cust.ok) throw new Error(cust.detail || 'could not set up payment');
  const r = method.type === 'card'
    ? await v4StartCardCharge({ customerId: cust.id, card: method.card, amount: l.price, currency: l.currency, reference, redirectUrl })
    : await v4StartMomoCharge({ customerId: cust.id, network: method.network, countryCode: method.countryCode, phone: method.phone, amount: l.price, currency: l.currency, reference, redirectUrl });
  if (!r.ok) throw new Error(r.detail || 'could not start payment');
  await kvPut(CHARGES, reference, { reference, chargeId: r.chargeId, userId: user.userId, listingId, status: r.status, createdAt: Date.now() });
  return { reference, chargeId: r.chargeId, status: r.status, nextAction: r.nextAction };
}

// Confirm a v4 charge (polled by the client, and by the webhook). Records the purchase + grants
// access once the charge is 'succeeded'. Returns { status, purchase? }.
export async function confirmV4Checkout(userId, reference) {
  const rec = await kvGet(CHARGES, reference);
  if (!rec || (userId && rec.userId !== userId)) return { status: 'not_found' };
  if (rec.recorded) return { status: 'succeeded', already: true };
  const v = await v4GetCharge(rec.chargeId);
  if (!v.ok) return { status: rec.status || 'pending' };
  if (v.status === 'succeeded') {
    const l = await getListing(rec.listingId);
    const user = { userId: rec.userId };
    const purchase = l ? await recordPurchase(user, l, { status: 'paid', ref: reference, provider: 'flutterwave_v4' }) : null;
    rec.recorded = true; rec.status = 'succeeded'; await kvPut(CHARGES, reference, rec);
    return { status: 'succeeded', purchase };
  }
  rec.status = v.status; await kvPut(CHARGES, reference, rec);
  return { status: v.status };
}

// Reconcile a v4 charge by reference from a charge.completed webhook.
export async function reconcileCharge(reference) {
  const rec = await kvGet(CHARGES, reference);
  if (rec) await confirmV4Checkout(null, reference);
}

// Live checkout: the browser paid via Flutterwave and returned a transaction id; verify it
// server-side (amount + currency + status) before recording the purchase and granting access.
export async function purchaseVerified(user, listingId, transactionId) {
  const l = await getListing(listingId);
  if (!l) throw new Error('listing not found');
  if (await hasPurchased(user.userId, listingId)) return { already: true };
  const v = await verifyPayment({ transactionId, amount: l.price, currency: l.currency });
  if (!v.ok) throw new Error(v.detail || 'payment could not be verified');
  return { purchase: await recordPurchase(user, l, { status: 'paid', ref: v.ref, provider: v.provider }) };
}
