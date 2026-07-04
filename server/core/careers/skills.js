// EFIKO — Career skills matching. Connects opportunities to EFIKO learning: extracts the
// skills an opportunity needs, suggests EFIKO Original courses that build them ("prepare
// with"), and — for a signed-in learner — recommends opportunities that match the courses
// they've taken. Deterministic keyword matching over the Originals' titles/competencies —
// no per-request AI, so it's fast and free.
import { listOriginals } from '../originals/store.js';

const STOP = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'use', 'using', 'how', 'are', 'from', 'into', 'this', 'that', 'more', 'essentials', 'course', 'remote', 'senior', 'junior', 'entry', 'level', 'manager', 'assistant', 'specialist', 'developer', 'engineer', 'analyst']);
const words = (s) => (String(s || '').toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || []).filter((w) => !STOP.has(w));

let _index = null; // { list: [{ courseId, title, keywords:Set }] }
async function courseIndex() {
  if (_index) return _index;
  const courses = await listOriginals({ status: 'published' });
  const list = courses.map((c) => ({
    courseId: c.courseId, title: c.title,
    keywords: new Set([...words(c.title), ...words(c.category), ...(c.competencies || []).flatMap(words), ...(c.outcomes || []).flatMap(words)])
  }));
  _index = { list };
  return _index;
}
export function resetCourseIndex() { _index = null; } // call after generating/publishing courses

const oppTerms = (o) => new Set([...(o.tags || []).flatMap(words), ...words(o.title), ...words(o.description).slice(0, 40)]);

// Short list of skill keywords for display on the card.
export function oppSkills(o) {
  const tags = (o.tags || []).map((t) => String(t).trim()).filter(Boolean);
  const fromTitle = words(o.title);
  return [...new Set([...tags, ...fromTitle])].slice(0, 6);
}

// EFIKO Originals that build the skills this opportunity needs (top 3).
export async function suggestCoursesForOpportunity(o) {
  const { list } = await courseIndex();
  const terms = oppTerms(o);
  return list
    .map((c) => ({ courseId: c.courseId, title: c.title, score: [...c.keywords].filter((k) => terms.has(k)).length }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ courseId, title }) => ({ courseId, title }));
}

// The skill keywords a learner has from the Originals they've taken.
export async function userSkills(takenCourseIds) {
  const { list } = await courseIndex();
  const byId = new Map(list.map((c) => [c.courseId, c]));
  const skills = new Set();
  for (const id of takenCourseIds) { const c = byId.get(id); if (c) for (const k of c.keywords) skills.add(k); }
  return skills;
}

// Rank opportunities by overlap with a learner's skills (most relevant first).
export function rankBySkills(opps, skills) {
  if (!skills || skills.size === 0) return [];
  return opps
    .map((o) => ({ o, score: [...oppTerms(o)].filter((k) => skills.has(k)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.o);
}
