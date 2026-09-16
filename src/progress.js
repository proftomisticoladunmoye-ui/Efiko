// EFIKO — client progress reporting (V2 → R8). Reports a learning event when the user is
// signed in. Now durable: instead of a fire-and-forget POST that vanished offline, the event is
// queued in the offline outbox, which persists it and syncs when connectivity returns — so
// progress, quiz attempts and completions are never lost on a weak connection.
import { enqueue } from './sync/outbox.js';

const token = () => { try { return localStorage.getItem('efiko-user-token') || ''; } catch { return ''; } };

/** payload: { courseId? | university+course, event: 'opened'|'completed'|'quiz', score?, total?, cohortId? } */
export function reportProgress(payload) {
  if (!token()) return; // visitors have no server progress
  enqueue('progress', payload).catch(() => {}); // queued offline, flushed on reconnect
}
