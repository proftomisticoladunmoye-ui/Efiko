// EFIKO — Course Repository (V1.5 Foundation, F2). The single abstraction that converges
// the two content models: legacy capsules (catalog.json + published) and ALWE lessons
// (bundled + alwe_lessons). A Course = one (university, course-code) unit containing
// lessons of either kind. Read-only aggregation — it does not change either store, so
// existing capsule/ALWE flows are untouched. See docs/PRODUCT-ARCHITECTURE-REVIEW.md (D4).
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getCatalog } from './content.js';
import { listPublished } from './published.js';
import { listAlweLessons } from './alwe/lessons.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALWE_DIR = join(HERE, '..', '..', 'public', 'alwe');

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const courseKey = (u, c) => `${slug(u) || 'efiko'}-${slug(c) || 'gen'}`;

/** The canonical courseId for a (university, course) pair — used by progress reporting. */
export function courseIdOf(university, course) { return courseKey(university, course); }

// A short, shareable join code derived deterministically from the courseId — no code
// store needed. Reverse lookup (code → course) scans the course list (F3 enrolment).
export function codeForCourse(courseId) {
  const h = createHash('sha1').update(String(courseId)).digest('hex');
  return parseInt(h.slice(0, 10), 16).toString(36).toUpperCase().slice(0, 6).padStart(6, 'X');
}

// Bundled ALWE lessons shipped in public/alwe (the kv store holds only published ones).
async function bundledAlwe() {
  try {
    const files = (await readdir(ALWE_DIR)).filter((f) => f.endsWith('.json'));
    const out = [];
    for (const f of files) {
      try {
        const m = JSON.parse(await readFile(join(ALWE_DIR, f), 'utf8')).manifest;
        if (m?.lessonId) out.push({ lessonId: m.lessonId, university: m.meta.university, course: m.meta.course, topic: m.meta.topic, scenes: 0 });
      } catch { /* skip malformed */ }
    }
    return out;
  } catch { return []; }
}

/** Build the full set of Courses by aggregating every content source. */
export async function buildCourses() {
  const [catalog, published, alwePub, alweBundled] = await Promise.all([
    getCatalog().catch(() => ({ capsules: [], packs: [] })),
    listPublished().catch(() => []),
    listAlweLessons().catch(() => []),
    bundledAlwe()
  ]);

  const map = new Map();
  const ensure = (u, c) => {
    const k = courseKey(u, c);
    if (!map.has(k)) map.set(k, { courseId: k, university: u || 'EFIKO', course: c || '', title: '', lessons: [] });
    return map.get(k);
  };

  // Capsule lessons (catalog + published, deduped by capsuleId).
  const seen = new Set();
  for (const cap of [...(catalog.capsules || []), ...published]) {
    if (!cap?.capsuleId || seen.has(cap.capsuleId)) continue;
    seen.add(cap.capsuleId);
    ensure(cap.university, cap.course).lessons.push({
      kind: 'capsule', id: cap.capsuleId, title: cap.topic || cap.capsuleId,
      sequence: cap.sequence || 1, durationMin: cap.durationMin || 4, sizeKB: cap.sizeKB || 18
    });
  }
  // Course titles from packs where available.
  for (const p of (catalog.packs || [])) {
    const co = map.get(courseKey(p.university, p.course));
    if (co && !co.title) co.title = p.title;
  }
  // ALWE lessons (bundled + published, deduped by lessonId).
  const seenL = new Set();
  for (const a of [...alweBundled, ...alwePub]) {
    if (!a?.lessonId || seenL.has(a.lessonId)) continue;
    seenL.add(a.lessonId);
    ensure(a.university, a.course).lessons.push({ kind: 'alwe', id: a.lessonId, title: a.topic || a.lessonId });
  }

  for (const co of map.values()) {
    if (!co.title) co.title = co.course ? `${co.course} — ${co.lessons[0]?.title || 'Course'}` : (co.lessons[0]?.title || 'Course');
    co.lessons.sort((x, y) => (x.kind === y.kind ? (x.sequence || 0) - (y.sequence || 0) : x.kind === 'capsule' ? -1 : 1));
    co.lessonCount = co.lessons.length;
    co.hasAdaptive = co.lessons.some((l) => l.kind === 'alwe');
    co.joinCode = codeForCourse(co.courseId);
  }
  return [...map.values()].filter((c) => c.lessonCount > 0);
}

/** Catalog rows (no lesson payloads). */
export async function listCourses() {
  return (await buildCourses()).map(({ lessons, ...rest }) => rest); // eslint-disable-line no-unused-vars
}

/** One course with its lessons. */
export async function getCourse(courseId) {
  return (await buildCourses()).find((c) => c.courseId === courseId) || null;
}
