// EFIKO — Opportunities console (V2 R5). An institution posts career opportunities (jobs,
// internships, scholarships) that appear on every learner's Career board. Requires the
// Institution Admin token.
import { useEffect, useState } from 'react';
import { hasAdminToken } from '../classes.js';
import { listMyOpportunities, postOpportunity, deleteOpportunity } from '../career.js';

const TYPES = [['job', 'Job'], ['internship', 'Internship'], ['scholarship', 'Scholarship'], ['volunteer', 'Volunteer']];
const toEpoch = (s) => (s ? new Date(`${s}T23:59:59`).getTime() : null);

export default function OpportunitiesConsole({ onExit }) {
  const [authed] = useState(hasAdminToken());
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ title: '', org: '', type: 'job', location: '', url: '', deadline: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { if (hasAdminToken()) listMyOpportunities().then(setItems); }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await postOpportunity({ ...f, deadline: toEpoch(f.deadline) });
      setItems(await listMyOpportunities());
      setF({ title: '', org: '', type: 'job', location: '', url: '', deadline: '', description: '' });
      setMsg('✓ Opportunity posted — it now appears on the Career board.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    setItems((p) => p.filter((x) => x.id !== id));
    try { await deleteOpportunity(id); } catch { setItems(await listMyOpportunities()); }
  }

  if (!authed) {
    return (
      <div className="studio">
        <button className="back" onClick={onExit}>← Home</button>
        <h2>Opportunities</h2>
        <p className="studio-sub">Please sign in as your institution first — open <strong>Institution Admin</strong> from Teach and log in, then return here.</p>
      </div>
    );
  }

  return (
    <div className="studio">
      <button className="back" onClick={onExit}>← Home</button>
      <h2>Career Opportunities</h2>
      <p className="studio-sub">Post jobs, internships and scholarships. They appear on every learner's Career board.</p>

      <form className="studio-form" onSubmit={create}>
        <input className="ask-input" placeholder="Title, e.g. Data Analyst Intern" value={f.title} onChange={set('title')} disabled={busy} />
        <input className="ask-input" placeholder="Organisation (optional)" value={f.org} onChange={set('org')} disabled={busy} />
        <div className="opp-form-row">
          <select className="ask-input" value={f.type} onChange={set('type')} disabled={busy} aria-label="Type">
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="ask-input" placeholder="Location (optional)" value={f.location} onChange={set('location')} disabled={busy} />
          <input className="ask-input" type="date" value={f.deadline} onChange={set('deadline')} disabled={busy} aria-label="Deadline" />
        </div>
        <input className="ask-input" placeholder="Application URL (optional)" value={f.url} onChange={set('url')} disabled={busy} />
        <textarea className="ask-input" rows={3} placeholder="Short description (optional)" value={f.description} onChange={set('description')} disabled={busy} />
        <button className="studio-btn" type="submit" disabled={busy || !f.title.trim()}>{busy ? 'Posting…' : 'Post opportunity'}</button>
      </form>
      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <h3 className="studio-pub-h">Your opportunities</h3>
      {items.length === 0 ? (
        <p className="studio-sub">None yet — post one above.</p>
      ) : (
        <div className="studio-pub-list">
          {items.map((o) => (
            <div key={o.id} className="pub-row">
              <span className="pub-topic">{o.title} <em>({o.type})</em></span>
              <button className="planner-del" onClick={() => remove(o.id)} aria-label="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
