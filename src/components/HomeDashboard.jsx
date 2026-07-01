// EFIKO 2.0 — Home dashboard (R1c). Answers "what's next?" at a glance: Continue Learning,
// Ask AI, Resume Discussion, Today's Progress, My Classes, Recent Courses. Uses data we
// already have (last-viewed lesson, enrolments, progress). No clutter.
import { useEffect, useState } from 'react';
import { listCapsules } from '../storage/capsuleStore.js';
import { fetchCourses } from '../courses.js';
import { fetchMyClasses } from '../enrol.js';
import ExamReadiness from './ExamReadiness.jsx';

export default function HomeDashboard({ user, readiness, enrolledIds = [], onOpenCapsule, onGoSection, onSignIn }) {
  const [recent, setRecent] = useState(null);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);

  // Last-viewed lesson (client-side; works offline).
  useEffect(() => {
    (async () => {
      try {
        const caps = await listCapsules();
        const viewed = caps.filter((c) => c.lastViewedAt).sort((a, b) => b.lastViewedAt - a.lastViewedAt);
        setRecent(viewed[0] || null);
      } catch { /* no IndexedDB */ }
    })();
  }, []);

  // Enrolled courses + classes (signed-in only).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setCourses([]); setClasses([]); return; }
      const all = await fetchCourses();
      if (cancelled) return;
      const set = new Set(enrolledIds);
      setCourses(all.filter((c) => set.has(c.courseId)).slice(0, 4));
      setClasses(await fetchMyClasses());
    })();
    return () => { cancelled = true; };
  }, [user, enrolledIds]);

  const first = user ? user.name.split(' ')[0] : null;

  return (
    <div className="home-dash">
      <div className="efiko-greeting">
        {user
          ? <><h2>👋 Hi {first}, what do you want to learn today?</h2><p>Pick up where you left off, or ask EFIKO AI above.</p></>
          : <><h2>Learn anything, anywhere — even offline.</h2><p>Ask EFIKO AI above, or explore courses. <button className="footer-link" onClick={onSignIn}>Sign in</button> to save your progress.</p></>}
      </div>

      <div className="dash-grid">
        {recent && (
          <button className="dash-card dash-continue" onClick={() => onOpenCapsule(recent.capsuleId)}>
            <span className="dash-kicker">▶ Continue learning</span>
            <strong>{recent.meta?.topic}</strong>
            <em>{recent.meta?.university} · {recent.meta?.course}</em>
          </button>
        )}
        <button className="dash-card" onClick={() => onGoSection('learn')}>
          <span className="dash-kicker">✦ Ask &amp; Learn</span>
          <strong>Ask EFIKO AI</strong>
          <em>Any topic, instantly</em>
        </button>
        <button className="dash-card" onClick={() => onGoSection('thinkspace')}>
          <span className="dash-kicker">🧠 ThinkSpace</span>
          <strong>Resume a discussion</strong>
          <em>Your AI workspace (coming soon)</em>
        </button>
      </div>

      <ExamReadiness readiness={readiness} />

      {classes.length > 0 && (
        <section className="dash-section">
          <h3>My Classes</h3>
          <div className="dash-list">
            {classes.map((c) => (
              <button key={c.cohortId} className="dash-row" onClick={() => onGoSection('courses')}>
                <span>👥 {c.title}</span><em>code {c.code}</em>
              </button>
            ))}
          </div>
        </section>
      )}

      {courses.length > 0 && (
        <section className="dash-section">
          <h3>Recent courses</h3>
          <div className="dash-list">
            {courses.map((c) => (
              <button key={c.courseId} className="dash-row" onClick={() => onGoSection('courses')}>
                <span>📚 {c.title}</span><em>{c.lessonCount} lesson{c.lessonCount !== 1 ? 's' : ''}{c.hasAdaptive ? ' · ✨ adaptive' : ''}</em>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
