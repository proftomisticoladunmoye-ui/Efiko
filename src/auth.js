// EFIKO — client auth (V1.5). Email+password accounts via the gateway. Optional: visitors
// use the app without an account; signing in unlocks the EFIKO AI home + saved identity.
// Token stored under 'efiko-user-token' (distinct from the institution-admin token).
import { consumeRef, clearRef } from './referral.js';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const KEY = 'efiko-user-token';

export const getToken = () => localStorage.getItem(KEY) || '';
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

async function post(path, body) {
  const r = await fetch(`${GATEWAY}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `request failed (${r.status})`);
  return d;
}

export async function signup(name, email, password) {
  const ref = consumeRef();
  const d = await post('/auth/signup', { name, email, password, ...(ref ? { ref } : {}) });
  setToken(d.token);
  clearRef(); // one-time: don't attribute later signups on this device
  return d.user;
}

export async function login(email, password) {
  const d = await post('/auth/login', { email, password });
  setToken(d.token);
  return d.user;
}

// Restore the session on boot (null if not signed in or token invalid/expired).
export async function me() {
  const t = getToken();
  if (!t) return null;
  try {
    const r = await fetch(`${GATEWAY}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) { if (r.status === 401) setToken(''); return null; }
    return (await r.json()).user;
  } catch {
    return null; // offline — stay a visitor this session
  }
}

export function logout() { setToken(''); }
