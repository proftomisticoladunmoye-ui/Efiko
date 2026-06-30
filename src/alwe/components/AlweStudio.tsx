// EFIKO ALWE — Lesson Studio. A lecturer types a topic, Claude authors a full ALWE lesson
// (validated server-side), they preview it in the real player, then publish it for
// students. Voice is added later via the player's "Download voice" (offline pack).
import { useEffect, useState, type ReactElement } from 'react';
import type { LessonPackage } from '../types';
import { generateLesson, publishLesson, listLessons, type LessonRow } from '../net/authoring';
import { savePackage } from '../store/PackageStore';

export default function AlweStudio({ onExit }: { onExit?: () => void }): ReactElement {
  const [topic, setTopic] = useState('');
  const [course, setCourse] = useState('');
  const [university, setUniversity] = useState('');
  const [draft, setDraft] = useState<LessonPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);

  useEffect(() => { listLessons().then(setLessons); }, []);

  async function generate(): Promise<void> {
    if (!topic.trim()) return;
    setBusy(true); setErr(null); setMsg(null); setDraft(null);
    try {
      setDraft(await generateLesson({ topic: topic.trim(), course: course.trim(), university: university.trim() }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function preview(): Promise<void> {
    if (!draft) return;
    await savePackage(draft, { pinned: false }); // store so the player can open it by id
    window.location.href = `${window.location.pathname}?alwe=${encodeURIComponent(draft.manifest.lessonId)}`;
  }

  async function publish(): Promise<void> {
    if (!draft) return;
    setPublishing(true); setErr(null);
    try {
      await publishLesson(draft);
      setMsg('✓ Published — students can open it now.');
      setLessons(await listLessons());
      setDraft(null); setTopic('');
    } catch (e) { setErr((e as Error).message); } finally { setPublishing(false); }
  }

  const sceneCount = draft?.scenes.length ?? 0;
  const arcCount = draft?.manifest.arc.length ?? 0;

  return (
    <div className="studio alwe-studio">
      <button className="back" onClick={onExit}>← Home</button>
      <h2>ALWE Lesson Studio</h2>
      <p className="studio-sub">Generate an adaptive whiteboard lesson with AI, preview it, then publish it for students.</p>

      <div className="studio-form">
        <input className="ask-input" placeholder="Topic, e.g. Supply and Demand" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
        <div className="studio-row">
          <input className="ask-input" placeholder="University code (optional)" value={university} onChange={(e) => setUniversity(e.target.value)} disabled={busy} />
          <input className="ask-input" placeholder="Course code (optional)" value={course} onChange={(e) => setCourse(e.target.value)} disabled={busy} />
        </div>
        <button className="studio-btn" disabled={busy || !topic.trim()} onClick={generate}>{busy ? 'Authoring lesson…' : 'Generate lesson'}</button>
      </div>

      {msg && <p className="studio-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}

      {draft && (
        <div className="studio-draft">
          <h3>{draft.manifest.meta.topic}</h3>
          <p className="studio-sub">{draft.manifest.meta.university} · {draft.manifest.meta.course} · {sceneCount} scenes · {arcCount} steps</p>
          <ol className="alwe-studio-arc">
            {draft.manifest.arc.map((n, i) => {
              const scene = n.kind === 'scene' ? draft.scenes.find((s) => s.id === n.sceneId) : null;
              return <li key={i}>{scene ? scene.title : (n.title || n.kind)}</li>;
            })}
          </ol>
          <div className="alwe-nav">
            <button className="ghost" onClick={preview}>▶ Preview in player</button>
            <button className="alwe-next" disabled={publishing} onClick={publish}>{publishing ? 'Publishing…' : 'Publish for students'}</button>
          </div>
        </div>
      )}

      <h3 className="studio-pub-h">Published ALWE lessons</h3>
      {lessons.length > 0 ? (
        <div className="studio-pub-list">
          {lessons.map((l) => (
            <div key={l.lessonId} className="pub-row">
              <span className="pub-topic">{l.topic} <em>({l.university} {l.course} · {l.scenes} scenes)</em></span>
              <a className="pub-open" href={`${window.location.pathname}?alwe=${encodeURIComponent(l.lessonId)}`}>Open</a>
            </div>
          ))}
        </div>
      ) : (
        <p className="studio-sub">None yet — generate and publish your first lesson above.</p>
      )}
    </div>
  );
}
