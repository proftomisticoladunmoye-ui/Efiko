// EFIKO — unified Courses catalog (V1.5 F2/F3). One surface over both content models:
// each course expands to its lessons, which open in the right viewer (capsule view or the
// ALWE player). F3 adds enrolment: join by class code, per-course Enrol/Enrolled state, and
// a shareable join link. Offline, it falls back to downloaded ALWE lessons.
import { useEffect, useState } from 'react';
import { fetchCourses, fetchCourse } from '../courses.js';
import { reportProgress } from '../progress.js';
import { listPackages } from '../alwe/store/PackageStore';
import { formatMoney } from '../currencies.js';

function openAlwe(id) {
  window.location.href = `${window.location.pathname}?alwe=${encodeURIComponent(id)}`;
}

export default function Courses({ onOpenCapsule, enrolledIds = [], onEnrol, signedIn, adaptiveOnly = false, heading, onGoSection }) {
  const [courses, setCourses] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});
  const [downloaded, setDownloaded] = useState([]);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState(null);
  const [copied, setCopied] = useState(null);

  const enrolled = new Set(enrolledIds);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchCourses();
      if (cancelled) return;
      setCourses(list);
      try {
        const pkgs = await listPackages();
        if (!cancelled) setDownloaded(pkgs.map((p) => ({
          lessonId: p.lessonId, topic: p.manifest.meta.topic, course: p.manifest.meta.course, university: p.manifest.meta.university
        })));
      } catch { /* no IndexedDB */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggle(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!detail[id]) {
      const c = await fetchCourse(id);
      if (c) setDetail((d) => ({ ...d, [id]: c }));
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setCodeMsg(null);
    try {
      await onEnrol({ code: code.trim() });
      setCodeMsg('✓ Enrolled! Find it marked below.');
      setCode('');
    } catch (e2) {
      if (e2.message !== 'auth') setCodeMsg(e2.message);
    }
  }

  async function enrolCourse(courseId) {
    try { await onEnrol({ courseId }); } catch { /* auth prompt handled by parent */ }
  }

  function copyJoin(joinCode) {
    const link = `${window.location.origin}${window.location.pathname}?join=${joinCode}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(joinCode); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  }

  const shown = adaptiveOnly ? courses.filter((c) => c.hasAdaptive) : courses;
  if (shown.length === 0 && downloaded.length === 0) return null;

  return (
    <section className="courses-card">
      <h2>{heading || '📚 Courses'}</h2>
      <p className="lib-sub">All your courses — adaptive whiteboard lessons and quick capsules, in one place.</p>

      <form className="enrol-form" onSubmit={submitCode}>
        <input className="ask-input" placeholder="Have a class code? Enter it to join" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
        <button className="course-open" type="submit" disabled={!code.trim()}>Join</button>
      </form>
      {codeMsg && <p className="enrol-msg">{codeMsg}</p>}

      {shown.length > 0 ? (
        <div className="courses-list">
          {shown.map((c) => (
            <div key={c.courseId} className="course-row">
              <div className="course-head">
                <button className="course-title-btn" onClick={() => toggle(c.courseId)} aria-expanded={expanded === c.courseId}>
                  <span className="course-meta">
                    <strong>{c.title}</strong>
                    <em>{c.university} {c.course} · {c.lessonCount} lesson{c.lessonCount !== 1 ? 's' : ''}</em>
                  </span>
                  <span className="course-caret">{expanded === c.courseId ? '▾' : '▸'}</span>
                </button>
                <span className="course-tags">
                  {c.hasAdaptive && <span className="badge-adaptive">✨ Adaptive</span>}
                  {c.gated
                    ? (c.owned
                        ? <span className="badge-enrolled">✓ Owned</span>
                        : <button className="course-enrol lock" onClick={() => onGoSection?.('market')}>🔒 Buy {formatMoney(c.price, c.currency)}</button>)
                    : (enrolled.has(c.courseId)
                        ? <span className="badge-enrolled">✓ Enrolled</span>
                        : <button className="course-enrol" onClick={() => enrolCourse(c.courseId)}>{signedIn ? 'Enrol' : 'Sign in to enrol'}</button>)}
                </span>
              </div>
              {expanded === c.courseId && detail[c.courseId] && (
                <div className="course-body">
                  {c.gated && !c.owned ? (
                    <div className="course-locked">
                      <p>🔒 Premium course — unlock all {c.lessonCount} lesson{c.lessonCount !== 1 ? 's' : ''}.</p>
                      <button className="course-open" onClick={() => onGoSection?.('market')}>Buy to unlock — {formatMoney(c.price, c.currency)}</button>
                    </div>
                  ) : (
                    <ul className="course-lessons">
                      {detail[c.courseId].lessons.map((l) => (
                        <li key={l.id} className="course-lesson">
                          <span>{l.kind === 'alwe' ? '✨' : '📄'} {l.title}</span>
                          <button className="course-open" onClick={() => { reportProgress({ courseId: c.courseId, event: 'opened' }); l.kind === 'alwe' ? openAlwe(l.id) : onOpenCapsule(l.id); }}>Open</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="course-share">Class code <code>{c.joinCode}</code>
                    <button className="course-share-btn" onClick={() => copyJoin(c.joinCode)}>{copied === c.joinCode ? 'Copied!' : '🔗 Copy join link'}</button>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="courses-list">
          {downloaded.map((a) => (
            <div key={a.lessonId} className="course-row">
              <button className="course-head course-title-btn" onClick={() => openAlwe(a.lessonId)}>
                <span className="course-meta"><strong>{a.topic}</strong><em>{a.university} {a.course} · offline</em></span>
                <span className="course-tags"><span className="badge-adaptive">✨ Adaptive</span></span>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
