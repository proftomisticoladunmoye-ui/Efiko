// EFIKO — client progress reporting (V2). Fire-and-forget: reports a learning event to the
// gateway when the user is signed in; a silent no-op for visitors and when offline.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => localStorage.getItem('efiko-user-token') || '';

/** payload: { courseId? | university+course, event: 'opened'|'completed'|'quiz', score?, total?, cohortId? } */
export function reportProgress(payload) {
  const t = token();
  if (!t) return; // visitors have no server progress
  try {
    fetch(`${GATEWAY}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(() => window.dispatchEvent(new Event('efiko-progress'))).catch(() => {});
  } catch { /* offline */ }
}
