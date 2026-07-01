// EFIKO — client certificates (V2). Claim a certificate for a mastered course, list mine,
// and verify one by serial (public). Uses the user token for claim/list; verify is public.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
export const CERT_PASS_MARK = 70;
const token = () => localStorage.getItem('efiko-user-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

export async function fetchMyCertificates() {
  try {
    const r = await fetch(`${GATEWAY}/certificates`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).certificates || [];
  } catch { return []; }
}

export async function fetchMyProgress() {
  try {
    const r = await fetch(`${GATEWAY}/progress`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).progress || [];
  } catch { return []; }
}

export async function claimCertificate(courseId) {
  const r = await fetch(`${GATEWAY}/certificates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ courseId })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.certificate;
}

export async function verifyCertificate(serial) {
  try {
    const r = await fetch(`${GATEWAY}/verify/${encodeURIComponent(serial)}`);
    if (!r.ok) return { valid: false };
    return await r.json();
  } catch { return { valid: false }; }
}
