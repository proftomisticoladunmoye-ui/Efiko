// EFIKO — platform operator accounts (YOU, the platform owner/staff). Distinct from both
// institution accounts (institutions.js, {orgId}) and learner accounts (users.js, {userId}).
// Operators gate EFIKO-owned actions: reviewing/publishing Originals, generating courses,
// approving creator payouts, controlling career aggregation. Token shape: {operatorId, role:'operator'}.
// Reuses the scrypt + kv primitives; persisted in Neon when DATABASE_URL is set, else files.
import { randomBytes } from 'node:crypto';
import { hashPassword } from './auth.js';
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'operators';
const normEmail = (e) => String(e || '').toLowerCase().trim();

// Public view — never leak the password hash.
export const publicOperator = (r) => ({ operatorId: r.operatorId, name: r.name, email: r.email, createdAt: r.createdAt });

export async function createOperator({ name, email, password }) {
  email = normEmail(email);
  if (!email || !password) throw new Error('email and password are required');
  if (await findByEmail(email)) throw new Error('an operator with that email already exists');
  const rec = {
    operatorId: `op_${randomBytes(8).toString('hex')}`,
    name: (name || 'Operator').trim(),
    email,
    passwordHash: hashPassword(password),
    createdAt: Date.now()
  };
  await kvPut(COLL, rec.operatorId, rec);
  return publicOperator(rec);
}

export async function findByEmail(email) {
  const e = normEmail(email);
  if (!e) return null;
  return (await kvAll(COLL)).find((r) => r.email === e) || null;
}

export async function getOperator(operatorId) {
  return operatorId ? kvGet(COLL, operatorId) : null;
}

export async function countOperators() {
  return (await kvAll(COLL)).length;
}

// One-time bootstrap: create the first operator from env vars if none exists yet. Lets you
// onboard yourself straight from the Render dashboard — no terminal, no master key juggling.
// Set OPERATOR_EMAIL + OPERATOR_PASSWORD (optionally OPERATOR_NAME). Safe to leave set: it
// only seeds when there are zero operators, and never overwrites an existing account.
export async function seedFromEnv() {
  const email = normEmail(process.env.OPERATOR_EMAIL);
  const password = (process.env.OPERATOR_PASSWORD || '').trim();
  if (!email || !password) return null;
  if (await countOperators() > 0) return null;   // already bootstrapped
  const op = await createOperator({ name: process.env.OPERATOR_NAME || 'EFIKO Operator', email, password });
  console.log(`[seed] created platform operator for ${email}`);
  return op;
}
