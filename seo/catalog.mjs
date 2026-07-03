// Efiko — build-time catalog loader for SEO content pages. Groups capsules into
// Courses -> Topics with real lesson text, so the prerender can emit an indexable course-hub
// page per course and a content page per topic.
//
// Two sources, same shape:
//   loadCourses()            — the static bundled catalog (always available, offline build)
//   fetchPublishedCourses()  — lecturer-published lessons from the live gateway (optional;
//                              gracefully returns null if the gateway is unreachable)
// mergeCourses() combines them (static wins on slug conflicts).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Extract text + first whiteboard figure + level from a full capsule object.
function capsuleToBody(c) {
  const blocks = (c && c.blocks) || [];
  const text = blocks.filter((b) => b.type === 'text' && b.value).map((b) => b.value.trim());
  const wb = blocks.find((b) => b.type === 'whiteboard');
  return { text, level: c?.meta?.level || '', figure: wb ? { src: wb.src, caption: wb.caption || '' } : null };
}

// Group entries [{ university, course, topic, sequence, durationMin, body }] into course trees.
function groupEntries(entries) {
  const courses = new Map();
  for (const e of entries) {
    const cslug = slugify(`${e.university}-${e.course}`);
    if (!courses.has(cslug)) courses.set(cslug, { slug: cslug, university: e.university, course: e.course, _topics: new Map() });
    const course = courses.get(cslug);
    const tslug = slugify(e.topic);
    if (!course._topics.has(tslug)) course._topics.set(tslug, { slug: tslug, topic: e.topic, entries: [] });
    course._topics.get(tslug).entries.push(e);
  }
  return [...courses.values()].map((c) => ({
    slug: c.slug, university: c.university, course: c.course,
    topics: [...c._topics.values()].map((t) => {
      const es = t.entries.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      return {
        slug: t.slug, topic: t.topic,
        level: es.find((x) => x.body.level)?.body.level || '',
        durationMin: es.reduce((s, x) => s + (x.durationMin || 0), 0),
        paragraphs: es.flatMap((x) => x.body.text),
        figure: es.find((x) => x.body.figure)?.body.figure || null
      };
    })
  }));
}

function loadCapsuleFile(capsuleId) {
  const f = join(pub, 'capsules', `${capsuleId}.json`);
  if (!existsSync(f)) return null;
  try { return capsuleToBody(JSON.parse(readFileSync(f, 'utf8'))); } catch { return null; }
}

export function loadCourses() {
  const catPath = join(pub, 'catalog.json');
  if (!existsSync(catPath)) return [];
  const capsules = (JSON.parse(readFileSync(catPath, 'utf8')).capsules) || [];
  const entries = capsules.map((cap) => ({ ...cap, body: loadCapsuleFile(cap.capsuleId) || { text: [], level: '', figure: null } }));
  return groupEntries(entries);
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Fetch lecturer-published lessons from the live gateway and group them. Returns null on any
// failure (offline build, gateway cold/down) so the build never breaks — it just falls back
// to the static catalog.
export async function fetchPublishedCourses(baseUrl, timeoutMs = 10000) {
  try {
    const list = await fetchJson(`${baseUrl}/studio/published`, timeoutMs);
    const summaries = list.capsules || [];
    const entries = [];
    for (const s of summaries) {
      const cap = await fetchJson(`${baseUrl}/studio/capsule/${encodeURIComponent(s.capsuleId)}`, timeoutMs).catch(() => null);
      entries.push({ university: s.university, course: s.course, topic: s.topic, sequence: s.sequence, durationMin: s.durationMin, body: cap ? capsuleToBody(cap) : { text: [], level: '', figure: null } });
    }
    return groupEntries(entries);
  } catch { return null; }
}

// Merge extra courses into base by course slug + topic slug (base wins on conflict).
export function mergeCourses(base, extra) {
  const map = new Map(base.map((c) => [c.slug, { ...c, topics: [...c.topics] }]));
  for (const c of extra) {
    if (!map.has(c.slug)) { map.set(c.slug, { ...c, topics: [...c.topics] }); continue; }
    const tgt = map.get(c.slug);
    const seen = new Set(tgt.topics.map((t) => t.slug));
    for (const t of c.topics) if (!seen.has(t.slug)) tgt.topics.push(t);
  }
  return [...map.values()];
}
