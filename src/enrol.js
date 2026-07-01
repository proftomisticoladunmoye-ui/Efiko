// EFIKO — client enrolment (V1.5 F3). Join a course by code or id; list my enrolments.
// Requires the user token (from the account panel); attaches it automatically.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

async function post(path, body) {
  const r = await fetch(`${GATEWAY}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `request failed (${r.status})`);
  return d;
}

export const enrolByCode = (code) => post('/enrol', { code });
export const enrolCourse = (courseId) => post('/enrol', { courseId });

export async function fetchEnrolments() {
  try {
    const r = await fetch(`${GATEWAY}/enrolments`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).courseIds || [];
  } catch { return []; }
}

export async function fetchMyClasses() {
  try {
    const r = await fetch(`${GATEWAY}/my-classes`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).classes || [];
  } catch { return []; }
}
