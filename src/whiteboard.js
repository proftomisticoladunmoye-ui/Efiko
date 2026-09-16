// EFIKO — AI Teaching Whiteboard client (R9). Fetches a narrated teaching sequence for a topic
// and remembers the last one so it can be replayed offline. Narration is spoken by the device
// (Web Speech API) in the player, so a sequence carries no audio — just text + small SVGs.
import { aiHeaders, notifyAiUsed } from './aiClient.js';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const KEY = 'efiko-last-board';

export async function fetchTeachingSequence(topic, lite) {
  const res = await fetch(`${GATEWAY}/whiteboard/teach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    body: JSON.stringify({ topic, lite: !!lite })
  });
  notifyAiUsed();
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `The whiteboard tutor is unavailable (${res.status}).`);
  }
  const { sequence } = await res.json();
  try { localStorage.setItem(KEY, JSON.stringify({ sequence, savedAt: Date.now() })); } catch { /* quota */ }
  return sequence;
}

// The most recent sequence, for offline replay.
export function loadLastBoard() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.sequence || null; } catch { return null; }
}
