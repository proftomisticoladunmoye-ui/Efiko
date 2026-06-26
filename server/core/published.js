// Efiko — Lecturer Studio store (Stage 12). Lessons a lecturer publishes, persisted
// to a JSON file so they survive restarts and can be synced to students.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'data', 'published.json');

let _items = null; // capsuleId -> capsule

async function load() {
  if (_items) return _items;
  _items = new Map();
  try {
    const arr = JSON.parse(await readFile(FILE, 'utf8'));
    for (const c of arr) _items.set(c.capsuleId, c);
  } catch { /* no file yet */ }
  return _items;
}

async function persist() {
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify([..._items.values()], null, 2));
}

export async function addPublished(capsule) {
  const items = await load();
  const rec = { ...capsule, published: true, publishedAt: Date.now() };
  items.set(rec.capsuleId, rec);
  await persist();
  return rec;
}

export async function getPublished(id) {
  return (await load()).get(id) || null;
}

// Catalog-style summaries for the student library / sync.
export async function listPublished() {
  const items = await load();
  return [...items.values()].map((c) => ({
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
