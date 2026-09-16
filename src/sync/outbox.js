// EFIKO — offline activity outbox (Offline Sync Engine, R8).
// Online → Download → Offline Learning → Local Storage → Reconnect → Synchronize.
//
// Learning activities (lesson opened/completed, quiz attempts, and — as those features grow —
// notes, bookmarks, whiteboard work) are queued in IndexedDB the moment they happen, so nothing
// is lost when the learner is offline. When connectivity returns the queue is flushed to the
// gateway's /sync endpoint in one batch and cleared on success; anything the server couldn't
// apply stays queued for the next attempt. A dedicated database keeps this fully isolated from
// the content DB (capsuleStore is that DB's sole migration authority).
import { openDB } from 'idb';
import { useEffect, useState } from 'react';

const DB = 'efiko-outbox';
const QUEUE = 'queue';
const META = 'meta';
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';
const token = () => { try { return localStorage.getItem('efiko-user-token') || ''; } catch { return ''; } };
const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

const dbp = openDB(DB, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
  }
});

const notify = () => { try { window.dispatchEvent(new Event('efiko-sync')); } catch { /* no window */ } };

export async function pendingCount() { return (await dbp).count(QUEUE); }
export async function pending() { return (await dbp).getAll(QUEUE); }
export async function getLastSynced() { return (await (await dbp).get(META, 'lastSynced'))?.value ?? null; }
async function setLastSynced(ts) { await (await dbp).put(META, { key: 'lastSynced', value: ts }); }

// Queue an activity for sync. Persists immediately (survives offline / reload) and then tries
// to flush right away when online, so the online experience is unchanged.
export async function enqueue(type, payload) {
  await (await dbp).add(QUEUE, { type, payload: payload || {}, ts: Date.now(), token: token() });
  notify();
  flush().catch(() => {});
}

let flushing = false;
// Send everything queued. Groups by the token that enqueued each item (so an item always syncs
// as the user who created it), and only advances "last synced" when the server actually accepts.
export async function flush() {
  if (flushing || !isOnline()) return;
  flushing = true;
  try {
    const db = await dbp;
    const items = await db.getAll(QUEUE);
    if (!items.length) return;

    const byToken = new Map();
    for (const it of items) {
      const t = it.token || token();
      if (!byToken.has(t)) byToken.set(t, []);
      byToken.get(t).push(it);
    }

    let anySuccess = false;
    for (const [t, group] of byToken) {
      if (!t) { // no auth (e.g. queued then signed out): drop so it can't pile up forever
        for (const it of group) await db.delete(QUEUE, it.id);
        continue;
      }
      const activities = group.map((it) => ({ id: it.id, type: it.type, ts: it.ts, ...it.payload }));
      try {
        const r = await fetch(`${GATEWAY}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({ activities })
        });
        if (!r.ok) throw new Error(`sync ${r.status}`);
        const d = await r.json().catch(() => ({}));
        const applied = Array.isArray(d.applied) ? d.applied : activities.map((a) => a.id);
        for (const id of applied) await db.delete(QUEUE, id);
        anySuccess = true;
      } catch { /* keep this group queued for the next attempt */ }
    }
    if (anySuccess) {
      await setLastSynced(Date.now());
      try { window.dispatchEvent(new Event('efiko-progress')); } catch { /* refresh progress-derived UI */ }
    }
    notify();
  } finally {
    flushing = false;
  }
}

// Flush automatically when connectivity returns, and once at startup (an app reopened online
// may have a queue left from an offline session).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flush().catch(() => {}); });
  flush().catch(() => {});
}

// React binding for the sync-status surface.
export function useSyncStatus() {
  const [state, setState] = useState({ pending: 0, lastSynced: null, online: isOnline() });
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [p, l] = await Promise.all([pendingCount(), getLastSynced()]);
      if (alive) setState({ pending: p, lastSynced: l, online: isOnline() });
    };
    refresh();
    window.addEventListener('efiko-sync', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    const iv = setInterval(refresh, 30000); // keep the "Xm ago" label current
    return () => {
      alive = false;
      window.removeEventListener('efiko-sync', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      clearInterval(iv);
    };
  }, []);
  return state;
}
