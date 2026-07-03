// EFIKO — Certificates section (V2), shown on the signed-in home. Lists earned certificates
// and courses the learner has mastered and can claim. A certificate opens as a printable
// card with a public verification link.
import { useEffect, useState } from 'react';
import { fetchMyCertificates, fetchMyProgress, claimCertificate, CERT_PASS_MARK } from '../certificates.js';
import { fetchCourses } from '../courses.js';
import CertificateCard from './CertificateCard.jsx';

export default function Certificates() {
  const [certs, setCerts] = useState([]);
  const [claimable, setClaimable] = useState([]);
  const [view, setView] = useState(null);   // certificate being viewed
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    const [myCerts, progress, courses] = await Promise.all([fetchMyCertificates(), fetchMyProgress(), fetchCourses()]);
    setCerts(myCerts);
    const titleOf = new Map(courses.map((c) => [c.courseId, c.title]));
    const haveCert = new Set(myCerts.map((c) => c.courseId));
    setClaimable(progress
      .filter((p) => (p.bestQuizPct ?? -1) >= CERT_PASS_MARK && !haveCert.has(p.courseId))
      .map((p) => ({ courseId: p.courseId, title: titleOf.get(p.courseId) || p.courseId, score: p.bestQuizPct })));
  }

  useEffect(() => { load(); }, []);

  async function claim(courseId) {
    setBusy(courseId); setErr(null);
    try {
      const cert = await claimCertificate(courseId);
      await load();
      setView(cert);
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  }

  if (certs.length === 0 && claimable.length === 0) return null;

  return (
    <section className="certs-card">
      <h2>🎓 Certificates</h2>
      {claimable.length > 0 && (
        <div className="certs-claim">
          {claimable.map((c) => (
            <div key={c.courseId} className="cert-claim-row">
              <span>You’ve mastered <strong>{c.title}</strong> ({c.score}%)</span>
              <button className="course-open" disabled={busy === c.courseId} onClick={() => claim(c.courseId)}>{busy === c.courseId ? 'Issuing…' : 'Claim certificate'}</button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {certs.length > 0 && (
        <div className="certs-list">
          {certs.map((c) => (
            <div key={c.serial} className="cert-earned">
              <span className="cert-earned-meta"><strong>{c.courseTitle}</strong><em>{c.serial}</em></span>
              <button className="course-enrol" onClick={() => setView(c)}>View</button>
            </div>
          ))}
        </div>
      )}

      {view && <CertificateCard cert={view} onClose={() => setView(null)} />}
    </section>
  );
}
