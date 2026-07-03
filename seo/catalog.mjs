// Efiko — build-time catalog loader for SEO content pages. Reads the static capsule catalog
// and the capsule bodies, grouping them into Courses -> Topics with real lesson text, so the
// prerender can emit an indexable course-hub page per course and a content page per topic.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Pull the text blocks (and first whiteboard caption/src) out of a capsule body.
function loadCapsule(capsuleId) {
  const f = join(pub, 'capsules', `${capsuleId}.json`);
  if (!existsSync(f)) return null;
  try {
    const c = JSON.parse(readFileSync(f, 'utf8'));
    const blocks = c.blocks || [];
    const text = blocks.filter((b) => b.type === 'text' && b.value).map((b) => b.value.trim());
    const wb = blocks.find((b) => b.type === 'whiteboard');
    return { text, level: c.meta?.level || '', figure: wb ? { src: wb.src, caption: wb.caption || '' } : null };
  } catch { return null; }
}

// Returns [{ slug, university, course, topics: [{ slug, topic, level, durationMin, paragraphs[], figure }] }]
export function loadCourses() {
  const catPath = join(pub, 'catalog.json');
  if (!existsSync(catPath)) return [];
  const capsules = (JSON.parse(readFileSync(catPath, 'utf8')).capsules) || [];

  const courses = new Map();
  for (const cap of capsules) {
    const cslug = slugify(`${cap.university}-${cap.course}`);
    if (!courses.has(cslug)) courses.set(cslug, { slug: cslug, university: cap.university, course: cap.course, _topics: new Map() });
    const course = courses.get(cslug);
    const tslug = slugify(cap.topic);
    if (!course._topics.has(tslug)) course._topics.set(tslug, { slug: tslug, topic: cap.topic, caps: [] });
    course._topics.get(tslug).caps.push(cap);
  }

  return [...courses.values()].map((c) => ({
    slug: c.slug,
    university: c.university,
    course: c.course,
    topics: [...c._topics.values()].map((t) => {
      const caps = t.caps.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const bodies = caps.map((x) => loadCapsule(x.capsuleId)).filter(Boolean);
      return {
        slug: t.slug,
        topic: t.topic,
        level: bodies[0]?.level || '',
        durationMin: caps.reduce((s, x) => s + (x.durationMin || 0), 0),
        paragraphs: bodies.flatMap((b) => b.text),
        figure: bodies.find((b) => b.figure)?.figure || null
      };
    })
  }));
}
