// EFIKO — offline sync status. Makes the sync engine legible to the learner:
// "Synced 10 minutes ago" and "12 activities waiting to sync", plus an honest offline state.
import { useSyncStatus, flush } from '../sync/outbox.js';

function ago(ts) {
  if (!ts) return null;
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

export default function SyncStatus() {
  const { pending, lastSynced, online } = useSyncStatus();
  const waiting = pending > 0;

  // Nothing to sync and nothing ever synced (e.g. a brand-new visitor) — stay out of the way.
  if (!waiting && !lastSynced && online) return null;

  const cls = !online ? 'offline' : waiting ? 'pending' : 'ok';
  const icon = !online ? '📵' : waiting ? '⏳' : '✅';

  let text;
  if (waiting) {
    text = <>{pending} {pending === 1 ? 'activity' : 'activities'} waiting to sync{online ? '…' : ' — will sync when you reconnect'}</>;
  } else if (!online) {
    text = <>Offline{lastSynced ? <> · last synced {ago(lastSynced)}</> : ''}</>;
  } else {
    text = <>Synced {ago(lastSynced)}</>;
  }

  return (
    <div className={`sync-status ${cls}`} role="status" aria-live="polite">
      <span className="sync-status-ico" aria-hidden="true">{icon}</span>
      <span className="sync-status-text">{text}</span>
      {waiting && online && (
        <button className="sync-status-now" onClick={() => flush()}>Sync now</button>
      )}
    </div>
  );
}
