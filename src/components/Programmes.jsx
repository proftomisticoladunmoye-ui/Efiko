// EFIKO — Programmes browse (V2), on the home. A programme groups courses into a track;
// enrolling in it enrols the learner in all its courses (which then appear in Courses).
import { useEffect, useState } from 'react';
import { fetchProgrammes, fetchProgramme } from '../programmes.js';

export default function Programmes({ onEnrolProgramme }) {
  const [programmes, setProgrammes] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { fetchProgrammes().then(setProgrammes); }, []);

  async function toggle(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!detail[id]) {
      const p = await fetchProgramme(id);
      if (p) setDetail((d) => ({ ...d, [id]: p }));
    }
  }

  async function enrol(id) {
    setBusy(id); setMsg(null);
    try {
      const ids = await onEnrolProgramme(id);
      setMsg(`✓ Enrolled in ${ids.length} course${ids.length !== 1 ? 's' : ''} — find them under Courses.`);
    } catch (e) {
      if (e.message !== 'auth') setMsg(e.message);
    } finally { setBusy(null); }
  }

  if (programmes.length === 0) return null;

  return (
    <section className="programmes-card">
      <h2>🧭 Programmes</h2>
      <p className="lib-sub">Guided tracks that bundle related courses. Enrol once to unlock them all.</p>
      {msg && <p className="enrol-msg">{msg}</p>}
      <div className="courses-list">
        {programmes.map((p) => (
          <div key={p.programmeId} className="course-row">
            <div className="course-head">
              <button className="course-title-btn" onClick={() => toggle(p.programmeId)} aria-expanded={expanded === p.programmeId}>
                <span className="course-meta">
                  <strong>{p.title}</strong>
                  <em>{p.courseCount} course{p.courseCount !== 1 ? 's' : ''}{p.description ? ` · ${p.description}` : ''}</em>
                </span>
                <span className="course-caret">{expanded === p.programmeId ? '▾' : '▸'}</span>
              </button>
              <span className="course-tags">
                <button className="course-enrol" disabled={busy === p.programmeId} onClick={() => enrol(p.programmeId)}>{busy === p.programmeId ? 'Enrolling…' : 'Enrol'}</button>
              </span>
            </div>
            {expanded === p.programmeId && detail[p.programmeId] && (
              <ul className="course-lessons">
                {detail[p.programmeId].courses.map((c) => (
                  <li key={c.courseId} className="course-lesson">
                    <span>📘 {c.title} <em className="prog-course-meta">({c.university} {c.course})</em></span>
                    {c.hasAdaptive && <span className="badge-adaptive">✨ Adaptive</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
