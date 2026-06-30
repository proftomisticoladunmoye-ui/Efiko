// EFIKO ALWE — published-lesson store. Durable via the kv layer (Neon when DATABASE_URL is
// set, else files), same as institutions/published. Holds full LessonPackages lecturers
// publish so students can open them. See docs/ALWE-ARCHITECTURE.md §4.
import { kvGet, kvPut, kvAll } from '../kv.js';

const COLL = 'alwe_lessons';

export async function addAlweLesson(pkg) {
  const id = pkg?.manifest?.lessonId;
  if (!id) throw new Error('package has no manifest.lessonId');
  const rec = { ...pkg, lessonId: id, publishedAt: Date.now() };
  await kvPut(COLL, id, rec);
  return rec;
}

export async function getAlweLesson(id) {
  return kvGet(COLL, id);
}

// Lightweight catalog rows for the Studio list / student library.
export async function listAlweLessons() {
  const all = await kvAll(COLL);
  return all.map((p) => ({
    lessonId: p.manifest.lessonId,
    university: p.manifest.meta.university,
    course: p.manifest.meta.course,
    topic: p.manifest.meta.topic,
    scenes: (p.scenes || []).length,
    publishedAt: p.publishedAt || 0
  }));
}
