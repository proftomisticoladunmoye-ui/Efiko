// EFIKO Originals — store (Phase 1). Draft -> in_review -> published workflow. kv-backed
// (Postgres when DATABASE_URL is set, else files). EFIKO-owned course library.
import { kvGet, kvPut, kvAll, kvDel } from '../kv.js';

const COLL = 'originals';
const STATUSES = ['draft', 'in_review', 'published'];

export async function saveOriginal(course) {
  if (!course?.courseId) throw new Error('courseId required');
  await kvPut(COLL, course.courseId, course);
  return course;
}

export async function getOriginal(courseId) {
  return courseId ? kvGet(COLL, courseId) : null;
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
  let all = await kvAll(COLL);
  if (status) all = all.filter((c) => c.status === status);
  return all.map(summary).sort((a, b) => b.updatedAt - a.updatedAt);
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
