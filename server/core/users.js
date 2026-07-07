// EFIKO — user accounts (V1.5 Foundation). Students (and later lecturers) sign up with
// email + password; reuses the scrypt + signed-token primitives from auth.js and the kv
// store (Neon when DATABASE_URL is set, else files). Distinct from institution accounts
// (institutions.js): different collection, different login endpoints, different token shape
// ({userId,role} vs {orgId}). See docs/PRODUCT-ARCHITECTURE-REVIEW.md (V1.5).
import { randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './auth.js';
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'users';
const ROLES = new Set(['student', 'lecturer']); // institution_admin/operator live in their own flows

const normEmail = (e) => String(e || '').toLowerCase().trim();
// Never leak the password hash.
export const publicUser = (u) => ({ userId: u.userId, name: u.name, email: u.email, role: u.role });

export async function findByEmail(email) {
  const e = normEmail(email);
  if (!e) return null;
  const all = await kvAll(COLL);
  return all.find((u) => u.email === e) || null;
}

export async function getUser(userId) {
  return userId ? kvGet(COLL, userId) : null;
}

export async function countUsers() {
  return (await kvAll(COLL)).length;
}

// Short, unambiguous, shareable referral code (8 hex chars, uppercase).
const newRefCode = () => randomBytes(4).toString('hex').toUpperCase();

export async function createUser({ name, email, password, role = 'student' }) {
  email = normEmail(email);
  if (!email || !password) throw new Error('email and password are required');
  if (String(password).length < 6) throw new Error('password must be at least 6 characters');
  if (await findByEmail(email)) throw new Error('an account with this email already exists');
  const rec = {
    userId: `u_${randomBytes(8).toString('hex')}`,
    name: String(name || email.split('@')[0]).trim(),
    email,
    passwordHash: hashPassword(password),
    role: ROLES.has(role) ? role : 'student',
    refCode: newRefCode(),
    createdAt: Date.now()
  };
  await kvPut(COLL, rec.userId, rec);
  return rec;
}

// Find a user by their referral code (case-insensitive).
export async function findByRefCode(code) {
  const c = String(code || '').toUpperCase().trim();
  if (!c) return null;
  return (await kvAll(COLL)).find((u) => (u.refCode || '').toUpperCase() === c) || null;
}

// Return the user's referral code, generating + persisting one if they predate the feature.
export async function ensureRefCode(userId) {
  const u = await getUser(userId);
  if (!u) return null;
  if (u.refCode) return u.refCode;
  for (let i = 0; i < 5; i++) {
    const code = newRefCode();
    if (!(await findByRefCode(code))) { u.refCode = code; await kvPut(COLL, u.userId, u); return code; }
  }
  return null;
}

// Record who referred this user — once only, and never a self-referral. Returns true if set.
export async function setReferredBy(userId, referrerId) {
  if (!userId || !referrerId || userId === referrerId) return false;
  const u = await getUser(userId);
  if (!u || u.referredBy) return false;
  u.referredBy = referrerId;
  await kvPut(COLL, u.userId, u);
  return true;
}

export async function authenticate(email, password) {
  const u = await findByEmail(email);
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  return u;
}
