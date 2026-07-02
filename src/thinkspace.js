// EFIKO — ThinkSpace client (V2 R2). Persistent AI discussions. Needs the user token.
import { notifyAiUsed } from './aiClient.js';
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';
const authHeaders = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

export async function listDiscussions() {
  try {
    const r = await fetch(`${GATEWAY}/thinkspace/discussions`, { headers: authHeaders() });
    if (!r.ok) return [];
    return (await r.json()).discussions || [];
  } catch { return []; }
}

export async function createDiscussion() {
  const r = await fetch(`${GATEWAY}/thinkspace/discussions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: '{}'
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.discussion;
}

export async function getDiscussion(id) {
  const r = await fetch(`${GATEWAY}/thinkspace/discussions/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (!r.ok) return null;
  return (await r.json()).discussion;
}

export async function ask(id, text) {
  const r = await fetch(`${GATEWAY}/thinkspace/discussions/${encodeURIComponent(id)}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ text })
  });
  const d = await r.json().catch(() => ({}));
  notifyAiUsed(); // refresh the credit meter
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d; // { message, title }
}

export async function generate(id, tool) {
  const r = await fetch(`${GATEWAY}/thinkspace/discussions/${encodeURIComponent(id)}/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ tool })
  });
  const d = await r.json().catch(() => ({}));
  notifyAiUsed();
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d.resource;
}
