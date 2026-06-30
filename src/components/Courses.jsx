// EFIKO — unified Courses catalog (V1.5 F2). One surface over both content models: each
// course expands to its lessons, which open in the right viewer (capsule view or the ALWE
// player). Offline, it falls back to downloaded ALWE lessons so nothing is hidden.
import { useEffect, useState } from 'react';
import { fetchCourses, fetchCourse } from '../courses.js';
import { listPackages } from '../alwe/store/PackageStore';

function openAlwe(id) {
  window.location.href = `${window.location.pathname}?alwe=${encodeURIComponent(id)}`;
}

export default function Courses({ onOpenCapsule }) {
  const [courses, setCourses] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});       // courseId -> course with lessons
  const [downloaded, setDownloaded] = useState([]); // offline ALWE packages

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
      } catch { /* IndexedDB unavailable */ }
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

  if (courses.length === 0 && downloaded.length === 0) return null;

  return (
    <section className="courses-card">
      <h2>📚 Courses</h2>
      <p className="lib-sub">All your courses — adaptive whiteboard lessons and quick capsules, in one place.</p>

      {courses.length > 0 ? (
        <div className="courses-list">
          {courses.map((c) => (
            <div key={c.courseId} className="course-row">
              <button className="course-head" onClick={() => toggle(c.courseId)} aria-expanded={expanded === c.courseId}>
                <span className="course-meta">
                  <strong>{c.title}</strong>
                  <em>{c.university} {c.course} · {c.lessonCount} lesson{c.lessonCount !== 1 ? 's' : ''}</em>
                </span>
                <span className="course-tags">
                  {c.hasAdaptive && <span className="badge-adaptive">✨ Adaptive</span>}
                  <span className="course-caret">{expanded === c.courseId ? '▾' : '▸'}</span>
                </span>
              </button>
              {expanded === c.courseId && detail[c.courseId] && (
                <ul className="course-lessons">
                  {detail[c.courseId].lessons.map((l) => (
                    <li key={l.id} className="course-lesson">
                      <span>{l.kind === 'alwe' ? '✨' : '📄'} {l.title}</span>
                      <button className="course-open" onClick={() => (l.kind === 'alwe' ? openAlwe(l.id) : onOpenCapsule(l.id))}>Open</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Offline: surface downloaded adaptive lessons directly so they stay reachable.
        <div className="courses-list">
          {downloaded.map((a) => (
            <div key={a.lessonId} className="course-row">
              <button className="course-head" onClick={() => openAlwe(a.lessonId)}>
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
