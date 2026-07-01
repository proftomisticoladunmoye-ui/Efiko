// EFIKO — Programmes (V2). A Programme is an institution-owned, ordered collection of
// Courses (a track / qualification). Students browse and enrol at the programme level,
// which enrols them in its courses. kv-backed. See PRODUCT-ARCHITECTURE-REVIEW (§3.1, D4).
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll } from './kv.js';
import { getCourse } from './courses.js';

const COLL = 'programmes';

export async function createProgramme({ ownerOrgId, title, description, courseIds }) {
  if (!ownerOrgId || !title) throw new Error('title is required');
  const ids = Array.isArray(courseIds) ? courseIds.filter(Boolean) : [];
  if (ids.length === 0) throw new Error('choose at least one course');
  const rec = {
    programmeId: `p_${randomBytes(6).toString('hex')}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    ownerOrgId,
    courseIds: ids,
    createdAt: Date.now()
  };
  await kvPut(COLL, rec.programmeId, rec);
  return rec;
}

export async function getProgramme(id) {
  return id ? kvGet(COLL, id) : null;
}

/** Summary rows for the catalog (no resolved courses). */
export async function listProgrammes() {
  return (await kvAll(COLL)).map((p) => ({
    programmeId: p.programmeId, title: p.title, description: p.description,
    ownerOrgId: p.ownerOrgId, courseCount: (p.courseIds || []).length
  })).sort((a, b) => a.title.localeCompare(b.title));
}

/** A programme with its courses resolved to summaries (for the detail view). */
export async function getProgrammeResolved(id) {
  const p = await getProgramme(id);
  if (!p) return null;
  const courses = [];
  for (const cid of p.courseIds || []) {
    const c = await getCourse(cid);
    if (c) courses.push({ courseId: c.courseId, title: c.title, university: c.university, course: c.course, lessonCount: c.lessonCount, hasAdaptive: c.hasAdaptive });
  }
  return { programmeId: p.programmeId, title: p.title, description: p.description, ownerOrgId: p.ownerOrgId, courses };
}
