// EFIKO — Study Planner (V2 R5). Personal study tasks with optional due dates, tied to the
// account. kv-backed. See docs/EFIKO-V2-REORGANIZATION.md (sidebar: Study Planner).
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';

const COLL = 'planner_tasks';

export async function addTask(userId, { title, courseId = null, dueAt = null }) {
  const t = String(title || '').trim();
  if (!t) throw new Error('title is required');
  const rec = { id: `t_${randomBytes(8).toString('hex')}`, userId, title: t, courseId, dueAt: dueAt ? Number(dueAt) : null, done: false, createdAt: Date.now() };
  await kvPut(COLL, rec.id, rec);
  return rec;
}

export async function listTasks(userId) {
  return (await kvAll(COLL))
    .filter((t) => t.userId === userId)
    .sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity) || a.createdAt - b.createdAt);
}

export async function toggleTask(userId, id) {
  const t = await kvGet(COLL, id);
  if (!t || t.userId !== userId) return null;
  t.done = !t.done;
  await kvPut(COLL, id, t);
  return t;
}

export async function deleteTask(userId, id) {
  const t = await kvGet(COLL, id);
  if (!t || t.userId !== userId) return false;
  await kvDel(COLL, id);
  return true;
}
