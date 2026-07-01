// EFIKO — Cohorts / Classes (V2). A lecturer (institution) creates a class for a course
// with its own random join code and roster. Students join the class; the lecturer sees who
// enrolled. Distinct from a course's deterministic joinCode (F3): a cohort is a specific,
// owned offering with a stored random code. See PRODUCT-ARCHITECTURE-REVIEW (D8).
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'cohorts';

// Friendly 6-char code (no ambiguous chars).
function newCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = randomBytes(6);
  return [...b].map((n) => alphabet[n % alphabet.length]).join('');
}

export async function createCohort({ ownerOrgId, courseId, title }) {
  if (!ownerOrgId || !courseId) throw new Error('ownerOrgId and courseId are required');
  let code = newCode();
  // avoid the (astronomically unlikely) collision
  while (await getCohortByCode(code)) code = newCode();
  const rec = {
    cohortId: `c_${randomBytes(6).toString('hex')}`,
    code,
    courseId,
    title: String(title || courseId).trim(),
    ownerOrgId,
    createdAt: Date.now()
  };
  await kvPut(COLL, rec.cohortId, rec);
  return rec;
}

export async function getCohort(cohortId) {
  return cohortId ? kvGet(COLL, cohortId) : null;
}

export async function getCohortByCode(code) {
  const c = String(code || '').toUpperCase().trim();
  if (!c) return null;
  return (await kvAll(COLL)).find((x) => x.code === c) || null;
}

export async function listCohortsByOrg(ownerOrgId) {
  return (await kvAll(COLL)).filter((x) => x.ownerOrgId === ownerOrgId).sort((a, b) => b.createdAt - a.createdAt);
}
