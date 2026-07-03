// EFIKO Originals — learner client (Phase 2). Reads the public catalog (published only) and
// full course content for the player.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

export async function listOriginals() {
  try {
    const r = await fetch(`${GATEWAY}/originals`);
    if (!r.ok) return [];
    return (await r.json()).courses || [];
  } catch { return []; }
}

export async function getOriginal(id) {
  try {
    const r = await fetch(`${GATEWAY}/originals/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Claim the certificate after passing the final assessment (needs the user token).
export async function claimOriginalCertificate(id) {
  const token = localStorage.getItem('efiko-user-token') || '';
  const r = await fetch(`${GATEWAY}/originals/${encodeURIComponent(id)}/certificate`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.certificate;
}
