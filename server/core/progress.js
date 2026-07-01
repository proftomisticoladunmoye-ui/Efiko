// EFIKO — learning progress (V2). Per-(user, course) summary the student reports and the
// lecturer sees per class. kv-backed; also gives cross-device progress for the account.
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'progress';
const key = (userId, courseId) => `${userId}__${courseId}`;

/**
 * Update a user's progress for a course from a reported event.
 * event: 'opened' | 'completed' | 'quiz' (with score/total).
 */
export async function recordProgress(userId, courseId, { event, score, total, cohortId } = {}) {
  const id = key(userId, courseId);
  const prev = (await kvGet(COLL, id)) || { id, userId, courseId, started: false, completed: false, bestQuizPct: null, attempts: 0 };
  const rec = { ...prev, lastActiveAt: Date.now() };
  if (cohortId) rec.cohortId = cohortId;
  if (event === 'opened') rec.started = true;
  if (event === 'completed') { rec.started = true; rec.completed = true; }
  if (event === 'quiz' && total > 0) {
    const pct = Math.round((score / total) * 100);
    rec.started = true;
    rec.attempts = (rec.attempts || 0) + 1;
    rec.bestQuizPct = Math.max(rec.bestQuizPct ?? 0, pct);
  }
  await kvPut(COLL, id, rec);
  return rec;
}

export async function getProgress(userId, courseId) {
  return kvGet(COLL, key(userId, courseId));
}

/** All progress records for a user (their own dashboard). */
export async function listProgress(userId) {
  return (await kvAll(COLL)).filter((p) => p.userId === userId);
}

/** Progress for a set of users in one course (lecturer class view). */
export async function progressForUsers(userIds, courseId) {
  const set = new Set(userIds);
  const all = await kvAll(COLL);
  const byUser = new Map();
  for (const p of all) if (p.courseId === courseId && set.has(p.userId)) byUser.set(p.userId, p);
  return byUser;
}
