// Efiko — offline store (Stage 1 §8; Stage 3 Offline Engine).
// Capsules + the catalog live in IndexedDB so the PWA opens and teaches with zero
// network. "Download Lesson" pins a capsule so it is never treated as disposable.
import { openDB } from 'idb';

const DB_NAME = 'Efiko';
const CAPS = 'capsules';
const META = 'meta';
const AUDIO = 'audio'; // voice-note bytes, for true-offline voice (Stage 11)

const dbPromise = openDB(DB_NAME, 3, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(CAPS)) {
      db.createObjectStore(CAPS, { keyPath: 'capsuleId' });
    }
    if (!db.objectStoreNames.contains(META)) {
      db.createObjectStore(META, { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains(AUDIO)) {
      db.createObjectStore(AUDIO, { keyPath: 'capsuleId' });
    }
  }
});

/**
 * Persist a capsule. `pinned` undefined preserves the existing pin state, so a
 * background version-update never silently un-pins a lesson the student downloaded.
 */
export async function saveCapsule(capsule, { pinned } = {}) {
  const db = await dbPromise;
  const existing = await db.get(CAPS, capsule.capsuleId);
  const rec = {
    ...capsule,
    pinned: pinned ?? existing?.pinned ?? false,
    savedAt: existing?.savedAt ?? Date.now(),
    updatedAt: Date.now(),
    lastViewedAt: existing?.lastViewedAt ?? null
  };
  await db.put(CAPS, rec);
  return rec;
}

export async function getCapsule(capsuleId) {
  return (await dbPromise).get(CAPS, capsuleId);
}

export async function listCapsules() {
  return (await dbPromise).getAll(CAPS);
}

export async function deleteCapsule(capsuleId) {
  return (await dbPromise).delete(CAPS, capsuleId);
}

export async function setPinned(capsuleId, pinned) {
  const db = await dbPromise;
  const c = await db.get(CAPS, capsuleId);
  if (!c) return;
  c.pinned = pinned;
  await db.put(CAPS, c);
  return c;
}

export async function touchViewed(capsuleId) {
  const db = await dbPromise;
  const c = await db.get(CAPS, capsuleId);
  if (!c) return;
  c.lastViewedAt = Date.now();
  await db.put(CAPS, c);
}

// --- Catalog (the "course updates" that sync brings; cached for offline use) ---
export async function saveCatalog(catalog) {
  await (await dbPromise).put(META, { key: 'catalog', value: catalog, savedAt: Date.now() });
}

export async function getCatalog() {
  const r = await (await dbPromise).get(META, 'catalog');
  return r?.value;
}

// --- Voice-note bytes (Stage 11) — so voice plays with zero network ---
export async function saveAudio(capsuleId, blob, mime) {
  await (await dbPromise).put(AUDIO, { capsuleId, blob, mime, savedAt: Date.now() });
}

export async function getAudio(capsuleId) {
  return (await dbPromise).get(AUDIO, capsuleId);
}

export async function hasAudio(capsuleId) {
  const db = await dbPromise;
  return (await db.getKey(AUDIO, capsuleId)) !== undefined;
}

export async function listAudioIds() {
  return (await dbPromise).getAllKeys(AUDIO);
}

export async function deleteAudio(capsuleId) {
  return (await dbPromise).delete(AUDIO, capsuleId);
}
