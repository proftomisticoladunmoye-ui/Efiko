// EFIKO — Marketplace pillar (V2 R5). Institutions list courses/packs for sale; learners buy
// them and gain a purchase record (access marker). Checkout goes through the pluggable payment
// adapter (payments.js) — a mock demo by default, Flutterwave-seamed for going live.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';
import { settlePayment, verifyPayment } from './payments.js';

const LISTINGS = 'market_listings';
const PURCHASES = 'market_purchases';

// Supported pricing currencies (ISO 4217, all Flutterwave-payable). Keep in sync with
// src/currencies.js on the client.
const CURRENCIES = ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF', 'XOF', 'EGP', 'EUR', 'GBP'];

export async function createListing(ownerOrgId, { title, description, courseId = null, price = 0, currency = 'NGN' }) {
  if (!ownerOrgId) throw new Error('institution required');
  const t = String(title || '').trim();
  if (!t) throw new Error('title is required');
  const rec = {
    id: `l_${randomBytes(7).toString('hex')}`,
    ownerOrgId,
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

export async function listListings() {
  return (await kvAll(LISTINGS)).sort((a, b) => b.createdAt - a.createdAt);
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
    status: pay.status || 'paid',
    ref: pay.ref,
    provider: pay.provider,
    createdAt: Date.now()
  };
  await kvPut(PURCHASES, rec.id, rec);
  return rec;
}

// Free items + demo (mock) checkout. In live mode, paid items settle via purchaseVerified().
export async function purchase(user, listingId) {
  const l = await getListing(listingId);
  if (!l) throw new Error('listing not found');
  if (await hasPurchased(user.userId, listingId)) return { already: true };
  const pay = await settlePayment({ amount: l.price, currency: l.currency, ref: `${listingId}_${user.userId}` });
  return { purchase: await recordPurchase(user, l, pay) };
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
