// EFIKO — Teach-Back client (R10). Sends the learner's own-words explanation to be assessed.
// Requires internet (it's an AI call), but the payload and response are tiny, so it works on 2G.
import { aiHeaders, notifyAiUsed } from './aiClient.js';

const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

export async function evaluateTeachBack(topic, explanation) {
  const res = await fetch(`${GATEWAY}/teachback/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    body: JSON.stringify({ topic, explanation })
  });
  notifyAiUsed();
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Could not evaluate (${res.status}).`);
  }
  return (await res.json()).evaluation;
}
