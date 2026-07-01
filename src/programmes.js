// EFIKO — client programmes (V2). Browse/enrol use the user token; create uses the
// institution admin token.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const userToken = () => localStorage.getItem('efiko-user-token') || '';
const adminToken = () => localStorage.getItem('efiko-admin-token') || '';

export async function fetchProgrammes() {
  try {
    const r = await fetch(`${GATEWAY}/programmes`);
    if (!r.ok) return [];
    return (await r.json()).programmes || [];
  } catch { return []; }
}

export async function fetchProgramme(id) {
  try {
    const r = await fetch(`${GATEWAY}/programmes/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function enrolProgramme(id) {
  const t = userToken();
  const r = await fetch(`${GATEWAY}/programmes/${encodeURIComponent(id)}/enrol`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: '{}'
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.courseIds || [];
}

export async function createProgrammeReq({ title, description, courseIds }) {
  const t = adminToken();
  const r = await fetch(`${GATEWAY}/programmes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify({ title, description, courseIds })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.programmeId;
}
