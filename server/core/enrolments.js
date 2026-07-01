// EFIKO — enrolment (V1.5 Foundation, F3). Ties a signed-in user to a Course via a join
// code / link. kv-backed; distinct from content stores. See PRODUCT-ARCHITECTURE-REVIEW (D8).
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';
import { listCourses } from './courses.js';

const COLL = 'enrolments';
const key = (userId, courseId) => `${userId}__${courseId}`;

export async function enrol(userId, courseId) {
  const rec = { id: key(userId, courseId), userId, courseId, enrolledAt: Date.now() };
  await kvPut(COLL, rec.id, rec);
  return rec;
}

export async function unenrol(userId, courseId) {
  await kvDel(COLL, key(userId, courseId));
}

export async function isEnrolled(userId, courseId) {
  return Boolean(await kvGet(COLL, key(userId, courseId)));
}

/** All course ids a user is enrolled in. */
export async function listEnrolments(userId) {
  const all = await kvAll(COLL);
  return all.filter((e) => e.userId === userId).map((e) => e.courseId);
}

/** Resolve a join code (case-insensitive) to a courseId, or null. */
export async function courseIdForCode(code) {
  const c = String(code || '').toUpperCase().trim();
  if (!c) return null;
  const found = (await listCourses()).find((x) => x.joinCode === c);
  return found ? found.courseId : null;
}
