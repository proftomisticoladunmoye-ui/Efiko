// EFIKO — client access to the unified Course Repository (V1.5 F2). Gracefully returns
// empty/null when offline (the legacy Library still serves downloaded capsules, and the
// Courses component falls back to downloaded ALWE lessons).
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
// Send the user token so the server can mark which gated courses this learner owns.
const authHeaders = () => { const t = localStorage.getItem('efiko-user-token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

export async function fetchCourses() {
  try {
    const r = await fetch(`${GATEWAY}/courses`, { cache: 'no-cache', headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).courses || [];
  } catch { return []; }
}

export async function fetchCourse(id) {
  try {
    const r = await fetch(`${GATEWAY}/courses/${encodeURIComponent(id)}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
