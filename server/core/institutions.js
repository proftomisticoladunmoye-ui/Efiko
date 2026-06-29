// Efiko — institution accounts + branding (Phase B), now persisted via the kv store
// (Postgres when DATABASE_URL is set, else files). Each record = one institution:
// login credentials + its white-label branding.
import { hashPassword } from './auth.js';
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'institutions';

// Public view (never leak the password hash).
const publicOrg = (r) => ({ orgId: r.orgId, institution: r.institution, email: r.email, active: r.active, branding: r.branding });

export async function createInstitution({ orgId, institution, email, password, active = false }) {
  orgId = String(orgId || '').toLowerCase().trim();
  if (!orgId || !email || !password) throw new Error('orgId, email and password are required');
  if (await kvGet(COLL, orgId)) throw new Error('orgId already exists');
  const rec = {
    orgId,
    institution: institution || orgId,
    email: String(email).toLowerCase().trim(),
    passwordHash: hashPassword(password),
    active: Boolean(active),
    branding: { id: orgId, name: institution || orgId, institution: institution || orgId, logo: '/logo.png', color: '#14b8a6', courseFilter: [] }
  };
  await kvPut(COLL, orgId, rec);
  return publicOrg(rec);
}

export async function findByEmail(email) {
  email = String(email).toLowerCase().trim();
  const all = await kvAll(COLL);
  return all.find((r) => r.email === email) || null;
}

export async function getOrg(orgId) {
  return kvGet(COLL, String(orgId).toLowerCase());
}

export async function setActive(orgId, active) {
  const r = await getOrg(orgId);
  if (!r) return null;
  r.active = Boolean(active);
  await kvPut(COLL, r.orgId, r);
  return publicOrg(r);
}

export async function updateBranding(orgId, branding) {
  const r = await getOrg(orgId);
  if (!r) return null;
  r.branding = {
    ...r.branding,
    name: branding.name ?? r.branding.name,
    logo: branding.logo ?? r.branding.logo,
    color: branding.color ?? r.branding.color,
    courseFilter: Array.isArray(branding.courseFilter) ? branding.courseFilter : r.branding.courseFilter,
    id: r.orgId,
    institution: r.institution
  };
  await kvPut(COLL, r.orgId, r);
  return r.branding;
}

export async function getBranding(orgId) {
  const r = await getOrg(orgId);
  return r ? r.branding : null;
}

// One-time bootstrap: create an admin account from env vars if it doesn't
// already exist. Lets a non-technical operator onboard the first institution
// straight from the Render dashboard — no terminal, no master key needed.
// Set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD (and optionally SEED_ORG_ID /
// SEED_INSTITUTION). Safe to leave set: it never overwrites an existing account.
export async function seedFromEnv() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim();
  const password = (process.env.SEED_ADMIN_PASSWORD || '').trim();
  if (!email || !password) return null;
  const orgId = (process.env.SEED_ORG_ID || 'admin').toLowerCase().trim();
  const institution = (process.env.SEED_INSTITUTION || orgId).trim();
  if (await getOrg(orgId)) return null;          // already onboarded — leave it
  if (await findByEmail(email)) return null;     // email taken under another org
  const org = await createInstitution({ orgId, institution, email, password, active: true });
  console.log(`[seed] created institution "${orgId}" for ${email}`);
  return org;
}

export { publicOrg };
