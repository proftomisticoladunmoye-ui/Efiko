// Efiko — Exam Readiness (Exam Mode). Shows a per-course readiness % from quiz
// history — the number students chase as exams approach.
export default function ExamReadiness({ readiness }) {
  const studied = (readiness || []).filter((r) => r.attempted > 0);
  if (studied.length === 0) return null; // appears once the student takes a quiz

  const tierOf = (pct) => (pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low');

  return (
    <section className="readiness">
      <h2>📊 Exam Readiness</h2>
      <p className="readiness-sub">From your quiz scores. Practise every topic and score well to reach 100%.</p>
      {studied
        .sort((a, b) => b.readiness - a.readiness)
        .map((r) => {
          const t = tierOf(r.readiness);
          return (
            <div key={r.key} className="ready-row">
              <div className="ready-info">
                <span className="ready-course">{r.university} · {r.course}</span>
                <span className="ready-meta">{r.attempted}/{r.total} topics practised</span>
                <div className="ready-bar"><div className={`ready-bar-fill ${t}`} style={{ width: `${r.readiness}%` }} /></div>
              </div>
              <span className={`ready-score ${t}`}>{r.readiness}%</span>
            </div>
          );
        })}
    </section>
  );
}
