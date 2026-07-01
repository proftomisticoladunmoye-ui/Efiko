// EFIKO — AI Credits (V2 R3). A per-user daily allowance for AI actions, refreshing each
// day by tier. Only *live AI* costs credits; downloaded lessons/whiteboards/courses always
// work. Anonymous visitors fall back to the per-IP rate limiter. See EFIKO-V2-REORGANIZATION §"AI Credits".
import { kvGet, kvPut } from './kv.js';

const COLL = 'credits';
const GRANTS = {
  free: Number(process.env.CREDITS_FREE_DAILY || 100),
  premium: Number(process.env.CREDITS_PREMIUM_DAILY || 500),
  lecturer: Number(process.env.CREDITS_LECTURER_DAILY || 1000)
};
const today = () => new Date().toISOString().slice(0, 10);
export const dailyGrant = (tier) => GRANTS[tier] ?? GRANTS.free;

/** Current credit state, refreshed to the daily grant if a new day has started. */
export async function getCredits(userId) {
  let c = await kvGet(COLL, userId);
  if (!c) c = { userId, tier: 'free', balance: dailyGrant('free'), refreshedAt: today() };
  if (c.refreshedAt !== today()) {
    c.balance = dailyGrant(c.tier);
    c.refreshedAt = today();
    await kvPut(COLL, userId, c);
  }
  return c;
}

/** Deduct `cost` if affordable. Returns { ok, balance, tier, dailyGrant }. */
export async function spend(userId, cost) {
  const c = await getCredits(userId);
  const grant = dailyGrant(c.tier);
  if (c.balance < cost) return { ok: false, balance: c.balance, tier: c.tier, dailyGrant: grant };
  c.balance -= cost;
  await kvPut(COLL, userId, c);
  return { ok: true, balance: c.balance, tier: c.tier, dailyGrant: grant };
}

/** Set a user's tier (monetisation / admin). Resets balance to the new grant. */
export async function setTier(userId, tier) {
  const c = await getCredits(userId);
  c.tier = tier;
  c.balance = dailyGrant(tier);
  await kvPut(COLL, userId, c);
  return c;
}
