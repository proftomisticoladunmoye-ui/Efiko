// EFIKO — Study Planner client (V2 R5). Personal study tasks. Needs the user token.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

export async function listTasks() {
  try {
    const r = await fetch(`${GATEWAY}/planner/tasks`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).tasks || [];
  } catch { return []; }
}

export async function addTask({ title, dueAt = null, courseId = null }) {
  const r = await fetch(`${GATEWAY}/planner/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title, dueAt, courseId })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.task;
}

export async function toggleTask(id) {
  const r = await fetch(`${GATEWAY}/planner/tasks/${encodeURIComponent(id)}/toggle`, {
    method: 'POST', headers: authHeaders()
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.task;
}

export async function deleteTask(id) {
  const r = await fetch(`${GATEWAY}/planner/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: authHeaders()
  });
  return r.ok;
}
