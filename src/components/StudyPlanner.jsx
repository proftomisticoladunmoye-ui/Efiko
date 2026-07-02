// EFIKO — Study Planner section (V2 R5). Personal study tasks with optional due dates, tied
// to the account so they sync across devices. See docs/EFIKO-V2-REORGANIZATION.md.
import { useEffect, useState } from 'react';
import { listTasks, addTask, toggleTask, deleteTask } from '../planner.js';

// Local date <-> epoch helpers. A due date is a calendar day (end-of-day), no time-of-day.
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const toInput = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fromInput = (s) => { if (!s) return null; const d = new Date(`${s}T23:59:59`); return d.getTime(); };
const fmtDue = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function dueLabel(ms) {
  if (!ms) return null;
  const today = startOfToday();
  const oneDay = 86400000;
  const day = new Date(ms); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today) / oneDay);
  if (diff < 0) return { text: `${-diff}d overdue`, tone: 'overdue' };
  if (diff === 0) return { text: 'Today', tone: 'today' };
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (diff <= 7) return { text: `${diff}d`, tone: 'soon' };
  return { text: fmtDue(ms), tone: 'later' };
}

export default function StudyPlanner() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);

  async function load() { setTasks(await listTasks()); setLoaded(true); }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true); setErr(null);
    try {
      const task = await addTask({ title: t, dueAt: fromInput(due) });
      setTasks((prev) => [...prev, task]);
      setTitle(''); setDue('');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function toggle(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    try { await toggleTask(id); } catch { load(); }
  }

  async function remove(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try { await deleteTask(id); } catch { load(); }
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <section className="planner">
      <h2>🗓️ Study Planner</h2>
      <p className="lib-sub">Plan your study — add tasks with an optional due date. They sync across your devices.</p>

      <form className="planner-add" onSubmit={add}>
        <input className="planner-title" type="text" placeholder="e.g. Revise chapter 4 — enzymes" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
        <input className="planner-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
        <button className="course-open" type="submit" disabled={!title.trim() || busy}>{busy ? 'Adding…' : 'Add task'}</button>
      </form>
      {err && <p className="error">{err}</p>}

      {loaded && tasks.length === 0 && <p className="planner-empty">No tasks yet. Add your first study task above.</p>}

      {open.length > 0 && (
        <ul className="planner-list">
          {open.map((t) => {
            const d = dueLabel(t.dueAt);
            return (
              <li key={t.id} className="planner-item">
                <button className="planner-check" onClick={() => toggle(t.id)} aria-label="Mark done">○</button>
                <span className="planner-name">{t.title}</span>
                {d && <span className={`planner-due ${d.tone}`}>{d.text}</span>}
                <button className="planner-del" onClick={() => remove(t.id)} aria-label="Delete task">×</button>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <details className="planner-done" open>
          <summary>Done ({done.length})</summary>
          <ul className="planner-list">
            {done.map((t) => (
              <li key={t.id} className="planner-item is-done">
                <button className="planner-check on" onClick={() => toggle(t.id)} aria-label="Mark not done">●</button>
                <span className="planner-name">{t.title}</span>
                <button className="planner-del" onClick={() => remove(t.id)} aria-label="Delete task">×</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
