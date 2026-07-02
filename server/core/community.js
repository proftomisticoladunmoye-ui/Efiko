// EFIKO — Community pillar (V2 R5). Lightweight study groups: any learner can create a group,
// others discover and join it, and members hold an async discussion (forum-style, poll-based —
// no websockets, so it stays low-data and offline-friendly). Owner + author can moderate posts.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';

const GROUPS = 'community_groups';
const MEMBERS = 'community_members'; // id = `${groupId}__${userId}`
const POSTS = 'community_posts';

const memberId = (groupId, userId) => `${groupId}__${userId}`;

export async function createGroup(user, { name, topic, courseId = null }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('group name is required');
  const rec = {
    id: `g_${randomBytes(7).toString('hex')}`,
    name: n,
    topic: String(topic || '').trim().slice(0, 200),
    courseId: courseId || null,
    ownerId: user.userId,
    ownerName: user.name || 'A learner',
    createdAt: Date.now()
  };
  await kvPut(GROUPS, rec.id, rec);
  await joinGroup(rec.id, user); // creator is the first member
  return rec;
}

export async function getGroup(id) {
  return id ? kvGet(GROUPS, id) : null;
}

export async function listGroups() {
  const [groups, members] = await Promise.all([kvAll(GROUPS), kvAll(MEMBERS)]);
  const counts = members.reduce((m, x) => { m[x.groupId] = (m[x.groupId] || 0) + 1; return m; }, {});
  return groups
    .map((g) => ({ ...g, memberCount: counts[g.id] || 0 }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function isMember(groupId, userId) {
  return !!(await kvGet(MEMBERS, memberId(groupId, userId)));
}

export async function joinGroup(groupId, user) {
  const id = memberId(groupId, user.userId);
  if (!(await kvGet(MEMBERS, id))) {
    await kvPut(MEMBERS, id, { groupId, userId: user.userId, name: user.name || 'A learner', joinedAt: Date.now() });
  }
  return true;
}

export async function leaveGroup(groupId, userId) {
  await kvDel(MEMBERS, memberId(groupId, userId));
  return true;
}

export async function listMembers(groupId) {
  return (await kvAll(MEMBERS)).filter((m) => m.groupId === groupId).sort((a, b) => a.joinedAt - b.joinedAt);
}

export async function myGroups(userId) {
  const mine = (await kvAll(MEMBERS)).filter((m) => m.userId === userId).map((m) => m.groupId);
  const set = new Set(mine);
  return (await listGroups()).filter((g) => set.has(g.id));
}

export async function addPost(groupId, user, text) {
  const t = String(text || '').trim();
  if (!t) throw new Error('message is required');
  const rec = {
    id: `p_${randomBytes(8).toString('hex')}`,
    groupId,
    userId: user.userId,
    name: user.name || 'A learner',
    text: t.slice(0, 4000),
    createdAt: Date.now()
  };
  await kvPut(POSTS, rec.id, rec);
  return rec;
}

export async function listPosts(groupId) {
  return (await kvAll(POSTS)).filter((p) => p.groupId === groupId).sort((a, b) => a.createdAt - b.createdAt);
}

// Author can delete own post; group owner can delete any post in the group.
export async function deletePost(groupId, userId, postId) {
  const [post, group] = await Promise.all([kvGet(POSTS, postId), getGroup(groupId)]);
  if (!post || post.groupId !== groupId) return false;
  if (post.userId !== userId && group?.ownerId !== userId) return false;
  await kvDel(POSTS, postId);
  return true;
}
