// EFIKO — lecturer/institution class management (V2). Uses the institution admin token
// saved by the Institution Admin panel (publishing/branding use the same token).
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-admin-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

export const hasAdminToken = () => !!token();

export async function listMyCohorts() {
  const r = await fetch(`${GATEWAY}/cohorts`, { headers: authHeaders() });
  if (!r.ok) return { ok: false, cohorts: [] };
  return { ok: true, cohorts: (await r.json()).cohorts || [] };
}

export async function createCohort(courseId, title) {
  const r = await fetch(`${GATEWAY}/cohorts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ courseId, title })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.cohort;
}

export async function fetchRoster(cohortId) {
  const r = await fetch(`${GATEWAY}/cohorts/${encodeURIComponent(cohortId)}/roster`, { headers: authHeaders() });
  if (!r.ok) return [];
  return (await r.json()).roster || [];
}

export async function fetchClassProgress(cohortId) {
  const r = await fetch(`${GATEWAY}/cohorts/${encodeURIComponent(cohortId)}/progress`, { headers: authHeaders() });
  if (!r.ok) return [];
  return (await r.json()).progress || [];
}

export async function fetchCoursesForSelect() {
  try {
    const r = await fetch(`${GATEWAY}/courses`);
    if (!r.ok) return [];
    return (await r.json()).courses || [];
  } catch { return []; }
}
