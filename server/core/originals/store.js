// EFIKO Originals — store. Draft -> in_review -> published workflow. Two sources:
//   - bundled seeds: EFIKO-owned launch courses committed at server/content/originals/*.json
//     (always published; ship with the platform, no DB needed) — like the bundled ALWE lessons.
//   - kv: operator-generated/edited courses (Postgres when DATABASE_URL is set, else files).
// kv records override a bundled seed with the same courseId.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kvGet, kvPut, kvAll, kvDel } from '../kv.js';

const COLL = 'originals';
const STATUSES = ['draft', 'in_review', 'published'];
const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const SEED_DIR = join(CONTENT, 'originals');       // free EFIKO Originals
const PREMIUM_DIR = join(CONTENT, 'premium');      // paid EFIKO Premium courses (gated by a listing)

function loadFrom(dir, extra = {}) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try { const c = JSON.parse(readFileSync(join(dir, f), 'utf8')); if (c?.courseId) out.push({ ...c, status: 'published', seed: true, ...extra }); } catch { /* skip malformed */ }
  }
  return out;
}
// Free Originals only — these populate the free catalog.
function loadSeeds() { return loadFrom(SEED_DIR); }
// Premium courses — retrievable for play (after purchase) but NEVER in the free catalog.
function loadPremiumSeeds() { return loadFrom(PREMIUM_DIR, { premium: true }); }

// Premium catalog rows (for a "Premium courses" view / marketplace).
export async function listPremiumCourses() {
  return loadPremiumSeeds().map(summary).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

export async function saveOriginal(course) {
  if (!course?.courseId) throw new Error('courseId required');
  await kvPut(COLL, course.courseId, course);
  return course;
}

export async function getOriginal(courseId) {
  if (!courseId) return null;
  const kvRec = await kvGet(COLL, courseId);
  if (kvRec) return kvRec;
  return [...loadSeeds(), ...loadPremiumSeeds()].find((c) => c.courseId === courseId) || null;
}

// Catalog rows (no heavy session payloads).
function summary(c) {
  return {
    courseId: c.courseId, title: c.title, subtitle: c.subtitle, category: c.category,
    level: c.level, estimatedHours: c.estimatedHours, owner: c.owner, status: c.status,
    sessionCount: (c.sessions || []).length, competencies: c.competencies || [],
    description: c.description, outcomes: c.outcomes || [], nextCourse: c.nextCourse, updatedAt: c.updatedAt
  };
}

export async function listOriginals({ status } = {}) {
  const kvRecs = await kvAll(COLL);
  const kvIds = new Set(kvRecs.map((c) => c.courseId));
  let all = [...kvRecs, ...loadSeeds().filter((s) => !kvIds.has(s.courseId))];
  if (status) all = all.filter((c) => c.status === status);
  return all.map(summary).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function setStatus(courseId, status, reviewer) {
  if (!STATUSES.includes(status)) throw new Error('invalid status');
  const c = await getOriginal(courseId);
  if (!c) return null;
  c.status = status;
  c.updatedAt = Date.now();
  if (status === 'published') c.reviewedBy = reviewer || c.reviewedBy || 'operator';
  await kvPut(COLL, courseId, c);
  return c;
}

// Apply human edits to a draft (title, description, outcomes, sessions, assessments, ...).
export async function updateOriginal(courseId, patch) {
  const c = await getOriginal(courseId);
  if (!c) return null;
  const merged = { ...c, ...patch, courseId: c.courseId, owner: c.owner, updatedAt: Date.now() };
  await kvPut(COLL, courseId, merged);
  return merged;
}

export async function deleteOriginal(courseId) {
  await kvDel(COLL, courseId);
  return true;
}
