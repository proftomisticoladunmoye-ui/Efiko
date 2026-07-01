// EFIKO — Classes console (V2). A lecturer/institution creates a class for a course, shares
// its join code/link, and views the roster. Requires an institution login (the token saved
// by the Institution Admin panel).
import { useEffect, useState } from 'react';
import { hasAdminToken, listMyCohorts, createCohort, fetchRoster, fetchClassProgress, fetchCoursesForSelect } from '../classes.js';

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString() : '—');

export default function Classes({ onExit }) {
  const [authed, setAuthed] = useState(hasAdminToken());
  const [courses, setCourses] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [rosters, setRosters] = useState({});   // cohortId -> [students]
  const [expanded, setExpanded] = useState(null);
  const [progress, setProgress] = useState({}); // cohortId -> [rows]
  const [progExpanded, setProgExpanded] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    (async () => {
      if (!hasAdminToken()) { setAuthed(false); return; }
      setCourses(await fetchCoursesForSelect());
      const r = await listMyCohorts();
      if (!r.ok) { setAuthed(false); return; }
      setAuthed(true); setCohorts(r.cohorts);
    })();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!courseId) return;
    setBusy(true); setErr(null);
    try {
      await createCohort(courseId, title.trim() || undefined);
      const r = await listMyCohorts();
      setCohorts(r.cohorts);
      setTitle('');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function viewRoster(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!rosters[id]) setRosters((m) => ({ ...m, [id]: (async () => await fetchRoster(id))() }));
    const list = await fetchRoster(id);
    setRosters((m) => ({ ...m, [id]: list }));
  }

  async function viewProgress(id) {
    if (progExpanded === id) { setProgExpanded(null); return; }
    setProgExpanded(id);
    const list = await fetchClassProgress(id);
    setProgress((m) => ({ ...m, [id]: list }));
  }

  function copyJoin(code) {
    const link = `${window.location.origin}${window.location.pathname}?join=${code}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  }

  if (!authed) {
    return (
      <div className="studio">
        <button className="back" onClick={onExit}>← Home</button>
        <h2>Classes</h2>
        <p className="studio-sub">Please sign in as your institution first — open <strong>Institution Admin</strong> from the home footer and log in, then return here.</p>
      </div>
    );
  }

  return (
    <div className="studio">
      <button className="back" onClick={onExit}>← Home</button>
      <h2>Classes</h2>
      <p className="studio-sub">Create a class for a course, share the join code with students, and see who has joined.</p>

      <form className="studio-form" onSubmit={create}>
        <select className="ask-input" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy}>
          <option value="">Choose a course…</option>
          {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.title} ({c.university} {c.course})</option>)}
        </select>
        <input className="ask-input" placeholder="Class name (optional), e.g. 2026 Morning Class" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        <button className="studio-btn" type="submit" disabled={busy || !courseId}>{busy ? 'Creating…' : 'Create class'}</button>
      </form>
      {err && <p className="error">{err}</p>}

      <h3 className="studio-pub-h">Your classes</h3>
      {cohorts.length === 0 ? (
        <p className="studio-sub">No classes yet — create one above.</p>
      ) : (
        <div className="studio-pub-list">
          {cohorts.map((c) => (
            <div key={c.cohortId} className="class-row">
              <div className="class-head">
                <span className="class-meta"><strong>{c.title}</strong><em>{c.students} student{c.students !== 1 ? 's' : ''}</em></span>
                <span className="class-actions">
                  <code className="class-code">{c.code}</code>
                  <button className="course-share-btn" onClick={() => copyJoin(c.code)}>{copied === c.code ? 'Copied!' : '🔗 Copy link'}</button>
                  <button className="course-enrol" onClick={() => viewRoster(c.cohortId)}>{expanded === c.cohortId ? 'Hide' : 'Roster'}</button>
                  <button className="course-enrol" onClick={() => viewProgress(c.cohortId)}>{progExpanded === c.cohortId ? 'Hide' : '📊 Progress'}</button>
                </span>
              </div>
              {expanded === c.cohortId && Array.isArray(rosters[c.cohortId]) && (
                <ul className="class-roster">
                  {rosters[c.cohortId].length === 0 ? <li className="studio-sub">No students yet — share the code above.</li>
                    : rosters[c.cohortId].map((s, i) => <li key={i}>{s.name} <em>&lt;{s.email}&gt;</em></li>)}
                </ul>
              )}
              {progExpanded === c.cohortId && Array.isArray(progress[c.cohortId]) && (
                progress[c.cohortId].length === 0 ? <p className="studio-sub">No students yet.</p> : (
                  <table className="class-progress">
                    <thead><tr><th>Student</th><th>Started</th><th>Best quiz</th><th>Completed</th><th>Last active</th></tr></thead>
                    <tbody>
                      {progress[c.cohortId].map((s, i) => (
                        <tr key={i}>
                          <td>{s.name}</td>
                          <td>{s.started ? '✓' : '—'}</td>
                          <td>{s.bestQuizPct != null ? `${s.bestQuizPct}%` : '—'}</td>
                          <td>{s.completed ? '✓' : '—'}</td>
                          <td>{fmtDate(s.lastActiveAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
