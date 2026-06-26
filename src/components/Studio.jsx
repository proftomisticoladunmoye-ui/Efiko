// Efiko — Lecturer Studio (Stage 12). A lecturer generates a lesson with the AI
// engine, reviews/edits the title + summary, and publishes it to the catalog so
// it reaches students across all channels.
import { useState } from 'react';
import CapsuleView from './CapsuleView.jsx';

function applyEdits(draft, title, summary) {
  const blocks = draft.blocks.map((b) => (b.type === 'summary' ? { ...b, value: summary } : b));
  return { ...draft, meta: { ...draft.meta, topic: title }, blocks };
}

export default function Studio({ onGenerate, onPublish, onOpenPublished, onBack, published, busy, publishing }) {
  const [topic, setTopic] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [draft, setDraft] = useState(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const generate = async (e) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    setMsg(null); setErr(null); setDraft(null);
    const capsule = await onGenerate({ topic: t, university: university.trim(), course: course.trim() });
    if (capsule) {
      setDraft(capsule);
      setTitle(capsule.meta.topic);
      setSummary(capsule.blocks.find((b) => b.type === 'summary')?.value || '');
    } else {
      setErr('Could not generate a draft. Check the connection and try again.');
    }
  };

  const publish = async () => {
    setMsg(null); setErr(null);
    const ok = await onPublish(applyEdits(draft, title.trim() || draft.meta.topic, summary));
    if (ok) { setMsg('✓ Published to the catalog — students can now find it.'); setDraft(null); setTopic(''); }
    else setErr('Publish failed. Is the gateway running?');
  };

  return (
    <div className="studio">
      <button className="back" onClick={onBack}>← Home</button>
      <h2>Lecturer Studio</h2>
      <p className="studio-sub">Create a lesson with AI, review it, then publish it for your students.</p>

      <form className="studio-form" onSubmit={generate}>
        <input className="ask-input" placeholder="Topic, e.g. Standard Deviation" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
        <div className="studio-row">
          <input className="ask-input" placeholder="University code (optional)" value={university} onChange={(e) => setUniversity(e.target.value)} disabled={busy} />
          <input className="ask-input" placeholder="Course code (optional)" value={course} onChange={(e) => setCourse(e.target.value)} disabled={busy} />
        </div>
        <button className="studio-btn" type="submit" disabled={busy || !topic.trim()}>{busy ? 'Generating…' : 'Generate draft'}</button>
      </form>

      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      {draft && (
        <div className="studio-draft">
          <h3>Review &amp; edit</h3>
          <label className="studio-field">Title
            <input className="ask-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="studio-field">Summary
            <textarea className="ask-input" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </label>
          <button className="studio-publish" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Publish to catalog'}</button>
          <div className="studio-preview">
            <CapsuleView capsule={applyEdits(draft, title, summary)} />
          </div>
        </div>
      )}

      <h3 className="studio-pub-h">Published lessons</h3>
      {published && published.length > 0 ? (
        <div className="studio-pub-list">
          {published.map((p) => (
            <div key={p.capsuleId} className="pub-row">
              <span className="pub-topic">{p.topic} <em>({p.university} {p.course})</em></span>
              <button onClick={() => onOpenPublished(p.capsuleId)}>Open</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="studio-sub">None yet — publish your first lesson above.</p>
      )}
    </div>
  );
}
