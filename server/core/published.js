// Efiko — Lecturer Studio store (Stage 12), now persisted via the kv store
// (Postgres when DATABASE_URL is set, else files). Lessons a lecturer publishes.
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'published';

export async function addPublished(capsule) {
  const rec = { ...capsule, published: true, publishedAt: Date.now() };
  await kvPut(COLL, rec.capsuleId, rec);
  return rec;
}

export async function getPublished(id) {
  return kvGet(COLL, id);
}

// Catalog-style summaries for the student library / sync.
export async function listPublished() {
  const all = await kvAll(COLL);
  return all.map((c) => ({
    capsuleId: c.capsuleId,
    version: c.version || 1,
    university: c.meta.university,
    course: c.meta.course,
    topic: c.meta.topic,
    sequence: c.meta.sequence || 1,
    durationMin: c.meta.durationMin || 4,
    sizeKB: c.totalSizeKB || 18,
    published: true
  }));
}
