// EFIKO Originals — learner client (Phase 2). Reads the public catalog (published only) and
// full course content for the player.
import { aiHeaders, notifyAiUsed } from './aiClient.js';
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

// Synthesize a session's voice narration (Deepgram TTS via the gateway). Returns an object
// URL for an <audio> element, or throws (e.g. 503 when voice isn't configured).
export async function synthesizeVoice(text) {
  const r = await fetch(`${GATEWAY}/alwe/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...aiHeaders() }, body: JSON.stringify({ text })
  });
  notifyAiUsed();
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `voice failed (${r.status})`); }
  return URL.createObjectURL(await r.blob());
}

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

// Learning Graph — ordered course pathways.
export async function listPathways() {
  try {
    const r = await fetch(`${GATEWAY}/pathways`);
    if (!r.ok) return [];
    return (await r.json()).pathways || [];
  } catch { return []; }
}

// Teach Back: EFIKO evaluates the learner's explanation of the covered sessions.
export async function evaluateTeachBack(id, fromSession, toSession, explanation) {
  const r = await fetch(`${GATEWAY}/originals/${encodeURIComponent(id)}/teachback`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    body: JSON.stringify({ fromSession, toSession, explanation })
  });
  notifyAiUsed();
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `failed (${r.status})`);
  return d; // { understood, score, feedback, missing }
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
