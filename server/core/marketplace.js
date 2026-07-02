// EFIKO — Marketplace pillar (V2 R5). Institutions list courses/packs for sale; learners buy
// them and gain a purchase record (access marker). Checkout goes through the pluggable payment
// adapter (payments.js) — a mock demo by default, Flutterwave-seamed for going live.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';
import { settlePayment } from './payments.js';

const LISTINGS = 'market_listings';
const PURCHASES = 'market_purchases';

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
    currency,
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

export async function purchase(user, listingId, email) {
  const l = await getListing(listingId);
  if (!l) throw new Error('listing not found');
  if (await hasPurchased(user.userId, listingId)) return { already: true };
  const pay = await settlePayment({ amount: l.price, currency: l.currency, email, ref: `${listingId}_${user.userId}` });
  const rec = {
    id: `pur_${randomBytes(8).toString('hex')}`,
    listingId,
    courseId: l.courseId,
    title: l.title,
    userId: user.userId,
    amount: l.price,
    currency: l.currency,
    status: pay.status,
    ref: pay.ref,
    provider: pay.provider,
    createdAt: Date.now()
  };
  await kvPut(PURCHASES, rec.id, rec);
  return { purchase: rec };
}
