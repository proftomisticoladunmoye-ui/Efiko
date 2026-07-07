// EFIKO — client referral helpers. A shared invite link (?ref=<code>) attributes new signups
// to the inviter, who earns XP + a badge (server-side). The code arriving in the URL is
// stashed until the visitor actually creates an account, then sent with the signup.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const REF_KEY = 'efiko-ref';

export const storeRef = (code) => { const c = String(code || '').trim(); if (c) localStorage.setItem(REF_KEY, c); };
export const consumeRef = () => localStorage.getItem(REF_KEY) || '';
export const clearRef = () => localStorage.removeItem(REF_KEY);

export function inviteLink(code) {
  const base = (typeof window !== 'undefined' && window.location.origin) || 'https://efikolearn.online';
  return `${base}/?ref=${encodeURIComponent(code)}`;
}

// { code, count, xpPerReferral } for the signed-in user, or null if unavailable.
export async function fetchReferral() {
  const t = localStorage.getItem('efiko-user-token') || '';
  if (!t) return null;
  try {
    const r = await fetch(`${GATEWAY}/referral`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
