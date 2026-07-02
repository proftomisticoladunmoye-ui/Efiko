// EFIKO — Career pillar (V2 R5). An opportunities board: institutions post jobs, internships
// and scholarships; students browse and bookmark them. Combined with existing certificates +
// progress, this gives each learner a lightweight career portfolio. See EFIKO-V2-REORGANIZATION.
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll, kvDel } from './kv.js';

const OPP = 'opportunities';
const SAVED = 'career_saved'; // one record per user: { userId, ids: [] }

const TYPES = ['job', 'internship', 'scholarship', 'volunteer'];

export async function createOpportunity(ownerOrgId, { title, org, type, location, url, deadline, description }) {
  if (!ownerOrgId) throw new Error('institution required');
  const t = String(title || '').trim();
  if (!t) throw new Error('title is required');
  const rec = {
    id: `op_${randomBytes(7).toString('hex')}`,
    ownerOrgId,
    title: t,
    org: String(org || '').trim(),
    type: TYPES.includes(type) ? type : 'job',
    location: String(location || '').trim(),
    url: String(url || '').trim(),
    deadline: deadline ? Number(deadline) : null,
    description: String(description || '').trim().slice(0, 2000),
    createdAt: Date.now()
  };
  await kvPut(OPP, rec.id, rec);
  return rec;
}

export async function listOpportunities() {
  const now = Date.now();
  return (await kvAll(OPP))
    .filter((o) => !o.deadline || o.deadline >= now - 86400000) // keep until a day past deadline
    .sort((a, b) => (a.deadline || Infinity) - (b.deadline || Infinity) || b.createdAt - a.createdAt);
}

export async function listOpportunitiesByOrg(ownerOrgId) {
  return (await kvAll(OPP)).filter((o) => o.ownerOrgId === ownerOrgId).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteOpportunity(ownerOrgId, id) {
  const o = await kvGet(OPP, id);
  if (!o || o.ownerOrgId !== ownerOrgId) return false;
  await kvDel(OPP, id);
  return true;
}

export async function listSaved(userId) {
  const rec = await kvGet(SAVED, userId);
  return rec?.ids || [];
}

export async function toggleSaved(userId, oppId) {
  const rec = (await kvGet(SAVED, userId)) || { userId, ids: [] };
  const i = rec.ids.indexOf(oppId);
  if (i >= 0) rec.ids.splice(i, 1); else rec.ids.push(oppId);
  await kvPut(SAVED, userId, rec);
  return rec.ids;
}
