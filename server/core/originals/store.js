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
const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'originals');

function loadSeeds() {
  if (!existsSync(SEED_DIR)) return [];
  const out = [];
  for (const f of readdirSync(SEED_DIR)) {
    if (!f.endsWith('.json')) continue;
    try { const c = JSON.parse(readFileSync(join(SEED_DIR, f), 'utf8')); if (c?.courseId) out.push({ ...c, status: 'published', seed: true }); } catch { /* skip malformed */ }
  }
  return out;
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
  return loadSeeds().find((c) => c.courseId === courseId) || null;
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
