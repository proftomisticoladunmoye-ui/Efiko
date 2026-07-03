// EFIKO — certificates (V2). A student who demonstrates mastery of a course earns a
// verifiable certificate with a public serial. kv-backed. See PRODUCT-ARCHITECTURE-REVIEW (§3.4).
import { randomBytes } from 'node:crypto';
import { kvGet, kvPut, kvAll } from './kv.js';

const COLL = 'certificates';
const key = (userId, courseId) => `${userId}__${courseId}`;

function newSerial() {
  return `EFIKO-${randomBytes(5).toString('hex').toUpperCase()}`;
}

/** Issue (or return the existing) certificate for a user + course. Optional fields
 * (competencies, hours, issuer, kind) let EFIKO Originals carry richer credential data. */
export async function issueCertificate({ userId, userName, courseId, courseTitle, score, competencies = null, hours = null, issuer = 'EFIKO', kind = 'course' }) {
  const id = key(userId, courseId);
  const existing = await kvGet(COLL, id);
  if (existing) return existing;
  let serial = newSerial();
  while (await verifyBySerial(serial)) serial = newSerial(); // avoid collision
  const rec = { certId: id, serial, userId, userName, courseId, courseTitle, score: score ?? null, competencies, hours, issuer, kind, issuedAt: Date.now() };
  await kvPut(COLL, id, rec);
  return rec;
}

export async function getCertificate(userId, courseId) {
  return kvGet(COLL, key(userId, courseId));
}

export async function listCertificates(userId) {
  return (await kvAll(COLL)).filter((c) => c.userId === userId).sort((a, b) => b.issuedAt - a.issuedAt);
}

/** Public verification: find a certificate by its serial. */
export async function verifyBySerial(serial) {
  const s = String(serial || '').toUpperCase().trim();
  if (!s) return null;
  return (await kvAll(COLL)).find((c) => c.serial === s) || null;
}
