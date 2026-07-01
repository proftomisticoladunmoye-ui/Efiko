// EFIKO — Programmes console (V2). An institution builds a programme by naming it and
// picking its courses. Requires an institution login (the Institution Admin token).
import { useEffect, useState } from 'react';
import { hasAdminToken, fetchCoursesForSelect } from '../classes.js';
import { createProgrammeReq, fetchProgrammes } from '../programmes.js';

export default function ProgrammesConsole({ onExit }) {
  const [authed] = useState(hasAdminToken());
  const [courses, setCourses] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!hasAdminToken()) return;
    fetchCoursesForSelect().then(setCourses);
    fetchProgrammes().then(setProgrammes);
  }, []);

  const chosen = Object.keys(picked).filter((k) => picked[k]);

  async function create(e) {
    e.preventDefault();
    if (!title.trim() || chosen.length === 0) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await createProgrammeReq({ title: title.trim(), description: description.trim(), courseIds: chosen });
      setProgrammes(await fetchProgrammes());
      setTitle(''); setDescription(''); setPicked({});
      setMsg('✓ Programme created.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  if (!authed) {
    return (
      <div className="studio">
        <button className="back" onClick={onExit}>← Home</button>
        <h2>Programmes</h2>
        <p className="studio-sub">Please sign in as your institution first — open <strong>Institution Admin</strong> from the home footer and log in, then return here.</p>
      </div>
    );
  }

  return (
    <div className="studio">
      <button className="back" onClick={onExit}>← Home</button>
      <h2>Programmes</h2>
      <p className="studio-sub">Group courses into a track. Students enrol once to unlock the whole programme.</p>

      <form className="studio-form" onSubmit={create}>
        <input className="ask-input" placeholder="Programme title, e.g. Psychometrics Track" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        <input className="ask-input" placeholder="Short description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
        <div className="prog-picker">
          <span className="studio-sub">Courses in this programme:</span>
          {courses.length === 0 ? <p className="studio-sub">No courses available.</p> : courses.map((c) => (
            <label key={c.courseId} className="prog-pick">
              <input type="checkbox" checked={!!picked[c.courseId]} onChange={(e) => setPicked((p) => ({ ...p, [c.courseId]: e.target.checked }))} />
              {c.title} <em>({c.university} {c.course})</em>
            </label>
          ))}
        </div>
        <button className="studio-btn" type="submit" disabled={busy || !title.trim() || chosen.length === 0}>{busy ? 'Creating…' : `Create programme (${chosen.length} course${chosen.length !== 1 ? 's' : ''})`}</button>
      </form>
      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <h3 className="studio-pub-h">Existing programmes</h3>
      {programmes.length === 0 ? (
        <p className="studio-sub">None yet — create one above.</p>
      ) : (
        <div className="studio-pub-list">
          {programmes.map((p) => (
            <div key={p.programmeId} className="pub-row">
              <span className="pub-topic">{p.title} <em>({p.courseCount} courses)</em></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
