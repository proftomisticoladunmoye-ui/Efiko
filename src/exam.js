// Efiko — Exam Mode (readiness). Turns quiz history into a per-course Readiness
// Score: a number students chase. Readiness rewards BOTH coverage (quiz every topic)
// and performance (score well) — an un-attempted capsule counts as 0, so you can't
// hit 100% without studying the whole course.
import { listMastery } from './storage/capsuleStore.js';

export async function computeReadiness(catalog) {
  const mastery = await listMastery();
  const byId = Object.fromEntries(mastery.map((m) => [m.capsuleId, m]));

  const courses = {};
  for (const c of catalog?.capsules || []) {
    const key = `${c.university} · ${c.course}`;
    (courses[key] ||= { key, university: c.university, course: c.course, ids: [] }).ids.push(c.capsuleId);
  }

  return Object.values(courses).map((co) => {
    const total = co.ids.length;
    const attempted = co.ids.filter((id) => byId[id]).length;
    const sumBest = co.ids.reduce((s, id) => s + (byId[id]?.bestPct || 0), 0);
    const readiness = total ? Math.round(sumBest / total) : 0;
    return { ...co, total, attempted, readiness };
  });
}
