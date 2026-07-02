// EFIKO — Community client (V2 R5). Study groups + member-only discussion. Needs the user token.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

export async function listGroups() {
  try {
    const r = await fetch(`${GATEWAY}/community/groups`);
    if (!r.ok) return [];
    return (await r.json()).groups || [];
  } catch { return []; }
}

export async function myGroups() {
  try {
    const r = await fetch(`${GATEWAY}/community/mine`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).groups || [];
  } catch { return []; }
}

export async function createGroup({ name, topic }) {
  const r = await fetch(`${GATEWAY}/community/groups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name, topic })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.group;
}

export async function getGroup(id) {
  try {
    const r = await fetch(`${GATEWAY}/community/groups/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json(); // { group, member, members, posts }
  } catch { return null; }
}

export async function joinGroup(id) {
  const r = await fetch(`${GATEWAY}/community/groups/${encodeURIComponent(id)}/join`, { method: 'POST', headers: authHeaders() });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return true;
}

export async function leaveGroup(id) {
  await fetch(`${GATEWAY}/community/groups/${encodeURIComponent(id)}/leave`, { method: 'POST', headers: authHeaders() });
  return true;
}

export async function postMessage(id, text) {
  const r = await fetch(`${GATEWAY}/community/groups/${encodeURIComponent(id)}/posts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ text })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.post;
}

export async function deletePost(groupId, postId) {
  const r = await fetch(`${GATEWAY}/community/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE', headers: authHeaders()
  });
  return r.ok;
}
