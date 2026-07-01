// EFIKO — ThinkSpace (V2, R2). Persistent AI discussions with memory. Each discussion keeps
// its own message history (the memory injected into the model on each ask). kv-backed.
// See docs/EFIKO-V2-REORGANIZATION.md §6-7.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll } from './kv.js';

const D = 'ts_discussions';
const M = 'ts_messages';

export async function createDiscussion(userId, { title = 'New Discussion', kind = 'general', context = {} } = {}) {
  const rec = { id: `d_${randomBytes(8).toString('hex')}`, userId, title, kind, context, createdAt: Date.now(), updatedAt: Date.now() };
  await kvPut(D, rec.id, rec);
  return rec;
}

export async function listDiscussions(userId) {
  return (await kvAll(D))
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((d) => ({ id: d.id, title: d.title, kind: d.kind, updatedAt: d.updatedAt }));
}

export async function getDiscussion(userId, id) {
  const d = await kvGet(D, id);
  if (!d || d.userId !== userId) return null;
  const messages = (await kvAll(M)).filter((m) => m.discussionId === id).sort((a, b) => a.createdAt - b.createdAt);
  return { ...d, messages };
}

export async function addMessage(discussionId, role, text) {
  const rec = { id: `m_${randomBytes(8).toString('hex')}`, discussionId, role, text, createdAt: Date.now() };
  await kvPut(M, rec.id, rec);
  return rec;
}

export async function touchDiscussion(id, patch = {}) {
  const d = await kvGet(D, id);
  if (!d) return;
  await kvPut(D, id, { ...d, ...patch, updatedAt: Date.now() });
}

/** The last N messages of a discussion (the rolling memory sent to the model). */
export async function recentMessages(discussionId, n = 12) {
  const msgs = (await kvAll(M)).filter((m) => m.discussionId === discussionId).sort((a, b) => a.createdAt - b.createdAt);
  return msgs.slice(-n);
}
