// EFIKO — Career client (V2 R5). Opportunities board + bookmarks.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const userToken = () => localStorage.getItem('efiko-user-token') || '';
const orgToken = () => localStorage.getItem('efiko-admin-token') || '';
const userHeaders = () => (userToken() ? { Authorization: `Bearer ${userToken()}` } : {});
const orgHeaders = () => (orgToken() ? { Authorization: `Bearer ${orgToken()}` } : {});

export async function listOpportunities() {
  try {
    const r = await fetch(`${GATEWAY}/opportunities`);
    if (!r.ok) return [];
    return (await r.json()).opportunities || [];
  } catch { return []; }
}

// Personalised opportunities matched to the courses the learner has taken.
export async function listForMe() {
  if (!userToken()) return [];
  try {
    const r = await fetch(`${GATEWAY}/career/for-me`, { headers: userHeaders() });
    if (!r.ok) return [];
    return (await r.json()).opportunities || [];
  } catch { return []; }
}

export async function listSaved() {
  try {
    const r = await fetch(`${GATEWAY}/career/saved`, { headers: userHeaders() });
    if (!r.ok) return [];
    return (await r.json()).ids || [];
  } catch { return []; }
}

export async function toggleSaved(id) {
  const r = await fetch(`${GATEWAY}/opportunities/${encodeURIComponent(id)}/save`, {
    method: 'POST', headers: userHeaders()
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.ids || [];
}

// --- institution-facing (opportunities console) ---
export async function listMyOpportunities() {
  try {
    const r = await fetch(`${GATEWAY}/opportunities/mine`, { headers: orgHeaders() });
    if (!r.ok) return [];
    return (await r.json()).opportunities || [];
  } catch { return []; }
}

export async function postOpportunity(payload) {
  const r = await fetch(`${GATEWAY}/opportunities`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...orgHeaders() },
    body: JSON.stringify(payload)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.opportunity;
}

export async function deleteOpportunity(id) {
  const r = await fetch(`${GATEWAY}/opportunities/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: orgHeaders()
  });
  return r.ok;
}
