// EFIKO Originals — Learning Graph. Named pathways (ordered course sequences) with stackable
// progression, so learners follow a journey instead of a flat catalogue and each course
// recommends the real next one. Pathways are committed at server/content/pathways.json.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOriginal } from './store.js';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'pathways.json');

function raw() {
  if (!existsSync(FILE)) return [];
  try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; }
}

const summary = (c) => ({ courseId: c.courseId, title: c.title, category: c.category, level: c.level, estimatedHours: c.estimatedHours, sessionCount: (c.sessions || []).length });

// Pathways with each course resolved to a summary (only courses that actually exist).
export async function listPathways() {
  const out = [];
  for (const p of raw()) {
    const courses = [];
    for (const cid of p.courses) { const c = await getOriginal(cid); if (c) courses.push(summary(c)); }
    if (courses.length) out.push({ id: p.id, title: p.title, description: p.description, courses });
  }
  return out;
}

// The next course after courseId within its pathway, or null.
export async function nextInPathway(courseId) {
  for (const p of raw()) {
    const i = p.courses.indexOf(courseId);
    if (i >= 0 && i + 1 < p.courses.length) { const c = await getOriginal(p.courses[i + 1]); if (c) return summary(c); }
  }
  return null;
}
