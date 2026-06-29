// EFIKO ALWE — offline package store (IndexedDB v5). Reuses the single Efiko DB
// connection owned by src/storage/capsuleStore.js (the migration authority), so the
// engine never opens a competing version. See docs/ALWE-ARCHITECTURE.md §4 & §12.
import { dbPromise } from '../../storage/capsuleStore.js';
import type {
  LessonPackage, StoredPackage, StoredClip, LessonProgress, LessonAnalytics
} from '../types';

const PACKAGES = 'alwe_packages';
const CLIPS = 'alwe_clips';
const PROGRESS = 'alwe_progress';
const ANALYTICS = 'alwe_analytics';

// ---- Packages (SceneGraph + manifest) ----

/**
 * Persist a downloaded lesson package. A re-download (new version) updates content
 * without clearing the student's pin — same discipline as saveCapsule().
 */
export async function savePackage(pkg: LessonPackage, opts: { pinned?: boolean } = {}): Promise<StoredPackage> {
  const db = await dbPromise;
  const lessonId = pkg.manifest.lessonId;
  const existing = (await db.get(PACKAGES, lessonId)) as StoredPackage | undefined;
  const rec: StoredPackage = {
    ...pkg,
    lessonId,
    version: pkg.manifest.version,
    pinned: opts.pinned ?? existing?.pinned ?? false,
    savedAt: existing?.savedAt ?? Date.now(),
    updatedAt: Date.now()
  };
  await db.put(PACKAGES, rec);
  return rec;
}

export async function getPackage(lessonId: string): Promise<StoredPackage | undefined> {
  return (await dbPromise).get(PACKAGES, lessonId) as Promise<StoredPackage | undefined>;
}

export async function listPackages(): Promise<StoredPackage[]> {
  return (await dbPromise).getAll(PACKAGES) as Promise<StoredPackage[]>;
}

export async function setPackagePinned(lessonId: string, pinned: boolean): Promise<void> {
  const db = await dbPromise;
  const rec = (await db.get(PACKAGES, lessonId)) as StoredPackage | undefined;
  if (!rec) return;
  rec.pinned = pinned;
  rec.updatedAt = Date.now();
  await db.put(PACKAGES, rec);
}

/** Remove a package and every clip belonging to it (free offline space). */
export async function deletePackage(lessonId: string): Promise<void> {
  const db = await dbPromise;
  await db.delete(PACKAGES, lessonId);
  const tx = db.transaction(CLIPS, 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if ((cursor.key as [string, string])[0] === lessonId) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  await db.delete(PROGRESS, lessonId);
  await db.delete(ANALYTICS, lessonId);
}

// ---- Voice clips (one Opus blob per segment) ----

export async function saveClip(lessonId: string, clipId: string, blob: Blob, mime = 'audio/ogg'): Promise<void> {
  const rec: StoredClip = { lessonId, clipId, blob, mime, bytes: blob.size, savedAt: Date.now() };
  await (await dbPromise).put(CLIPS, rec);
}

export async function getClip(lessonId: string, clipId: string): Promise<StoredClip | undefined> {
  return (await dbPromise).get(CLIPS, [lessonId, clipId]) as Promise<StoredClip | undefined>;
}

export async function hasClip(lessonId: string, clipId: string): Promise<boolean> {
  return (await (await dbPromise).getKey(CLIPS, [lessonId, clipId])) !== undefined;
}

/** Total bytes a downloaded lesson occupies (package JSON is negligible; clips dominate). */
export async function clipBytes(lessonId: string): Promise<number> {
  const db = await dbPromise;
  const tx = db.transaction(CLIPS, 'readonly');
  let total = 0;
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if ((cursor.key as [string, string])[0] === lessonId) total += (cursor.value as StoredClip).bytes || 0;
    cursor = await cursor.continue();
  }
  await tx.done;
  return total;
}

// ---- Progress (resume, completion, bookmarks) ----

export async function getProgress(lessonId: string): Promise<LessonProgress | undefined> {
  return (await dbPromise).get(PROGRESS, lessonId) as Promise<LessonProgress | undefined>;
}

export async function saveProgress(progress: LessonProgress): Promise<void> {
  await (await dbPromise).put(PROGRESS, { ...progress, updatedAt: Date.now() });
}

// ---- Analytics (Cognitive Tutor input) ----

export async function getAnalytics(lessonId: string): Promise<LessonAnalytics | undefined> {
  return (await dbPromise).get(ANALYTICS, lessonId) as Promise<LessonAnalytics | undefined>;
}

export async function saveAnalytics(analytics: LessonAnalytics): Promise<void> {
  await (await dbPromise).put(ANALYTICS, { ...analytics, updatedAt: Date.now() });
}
