// Efiko — institution accounts + branding (Phase B). File-backed, like published.js.
// Each record = one paying institution: login credentials + its white-label branding.
// NOTE: the file lives on the (ephemeral on Render free) disk — move to a database
// before relying on it in production so accounts survive redeploys.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hashPassword } from './auth.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'data', 'institutions.json');

let _map = null;

async function load() {
  if (_map) return _map;
  _map = new Map();
  try {
    const obj = JSON.parse(await readFile(FILE, 'utf8'));
    for (const [k, v] of Object.entries(obj)) _map.set(k, v);
  } catch { /* no file yet */ }
  return _map;
}

async function persist() {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(Object.fromEntries(_map), null, 2));
}

// Public view (never leak the password hash).
const publicOrg = (r) => ({ orgId: r.orgId, institution: r.institution, email: r.email, active: r.active, branding: r.branding });

export async function createInstitution({ orgId, institution, email, password, active = false }) {
  const m = await load();
  orgId = String(orgId).toLowerCase().trim();
  if (!orgId || !email || !password) throw new Error('orgId, email and password are required');
  if (m.has(orgId)) throw new Error('orgId already exists');
  const rec = {
    orgId,
    institution: institution || orgId,
    email: String(email).toLowerCase().trim(),
    passwordHash: hashPassword(password),
    active: Boolean(active),
    branding: { id: orgId, name: institution || orgId, institution: institution || orgId, logo: '/logo.png', color: '#14b8a6', courseFilter: [] }
  };
  m.set(orgId, rec);
  await persist();
  return publicOrg(rec);
}

export async function findByEmail(email) {
  const m = await load();
  email = String(email).toLowerCase().trim();
  for (const r of m.values()) if (r.email === email) return r;
  return null;
}

export async function getOrg(orgId) {
  return (await load()).get(String(orgId).toLowerCase()) || null;
}

export async function setActive(orgId, active) {
  const m = await load();
  const r = m.get(String(orgId).toLowerCase());
  if (!r) return null;
  r.active = Boolean(active);
  await persist();
  return publicOrg(r);
}

export async function updateBranding(orgId, branding) {
  const m = await load();
  const r = m.get(String(orgId).toLowerCase());
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
  await persist();
  return r.branding;
}

// Public branding for the app's tenant theming (no secrets).
export async function getBranding(orgId) {
  const r = await getOrg(orgId);
  return r ? r.branding : null;
}

export { publicOrg };
