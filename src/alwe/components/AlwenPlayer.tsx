// EFIKO ALWE — lesson player (Batch 3): walks the full arc (Intro → scenes → mini-quiz
// → reflection → summary → final quiz) with Prev/Next, jump-to-scene outline, replay
// scene, bookmarks, and continue-from-last-position. Scene playback lives in SceneNode.
import { useEffect, useMemo, useReducer, useState, type ReactElement } from 'react';
import type { LessonPackage, LearningMode, Bookmark } from '../types';
import { LessonController } from '../engine/LessonController';
import { savePackage, getPackage, getProgress, saveProgress } from '../store/PackageStore';
import SceneNode from './SceneNode';
import NodeCard from './NodeCard';
import QuizNode from './QuizNode';
import LessonOutline from './LessonOutline';

async function loadPackage(lessonId: string): Promise<LessonPackage> {
  const stored = await getPackage(lessonId);
  if (stored) return stored;
  const res = await fetch(`/alwe/${lessonId}.json`);
  if (!res.ok) throw new Error(`Lesson "${lessonId}" not found`);
  const pkg = (await res.json()) as LessonPackage;
  await savePackage(pkg, { pinned: true });
  return pkg;
}

export default function AlwenPlayer({ lessonId, onExit }: { lessonId: string; onExit?: () => void }): ReactElement {
  const [pkg, setPkg] = useState<LessonPackage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mode] = useState<LearningMode>('normal');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [resume, setResume] = useState<{ index: number; elapsedMs: number } | null>(null);
  const [resumeConsumedAt, setResumeConsumedAt] = useState(-1);
  const [epoch, setEpoch] = useState(0); // bumped on every navigation to force a fresh SceneNode

  const ctrl = useMemo(() => (pkg ? new LessonController(pkg) : null), [pkg]);

  // Load package, then restore any saved progress (offer to resume).
  useEffect(() => {
    let cancelled = false;
    loadPackage(lessonId).then(async (p) => {
      if (cancelled) return;
      setPkg(p);
      const prog = await getProgress(lessonId);
      if (cancelled) return;
      if (prog) {
        setSpeed(prog.speed || 1);
        setBookmarks(prog.bookmarks || []);
        if (prog.lastNodeIndex > 0 || prog.lastElapsedMs > 0) setResume({ index: prog.lastNodeIndex, elapsedMs: prog.lastElapsedMs });
      }
    }).catch((e) => !cancelled && setErr(e.message));
    return () => { cancelled = true; };
  }, [lessonId]);

  function persist(elapsedMs: number, marks = bookmarks): void {
    if (!ctrl) return;
    void saveProgress(ctrl.toProgress(lessonId, { elapsedMs, speed, mode, bookmarks: marks }));
  }

  function go(i: number): void {
    if (!ctrl) return;
    ctrl.goTo(i);
    setIndex(ctrl.index);
    setEpoch((e) => e + 1);
    setOutlineOpen(false);
    persist(0);
  }
  function next(): void {
    if (!ctrl) return;
    const sc = ctrl.sceneOf();
    if (sc) ctrl.markCompleted(sc.id);
    go(ctrl.index + 1);
  }

  function addBookmark(sceneId: string, atMs: number): void {
    const marks = [...bookmarks, { sceneId, atMs }];
    setBookmarks(marks);
    persist(atMs, marks);
  }
  function jumpToBookmark(b: Bookmark): void {
    if (!ctrl) return;
    const i = ctrl.arc.findIndex((n) => n.sceneId === b.sceneId);
    if (i >= 0) { setResume({ index: i, elapsedMs: b.atMs }); go(i); }
  }

  if (err) return <div className="alwe-player"><button className="back" onClick={onExit}>← Back</button><p className="error">{err}</p></div>;
  if (!pkg || !ctrl) return <div className="alwe-player"><p className="alwe-loading">Loading lesson…</p></div>;

  // Resume banner (shown until the learner chooses).
  if (resume && index === 0 && resumeConsumedAt === -1) {
    const node = ctrl.arc[resume.index];
    const label = LessonController.labelFor(node, ctrl.sceneOf(node)?.title);
    return (
      <div className="alwe-player">
        <div className="alwe-topbar"><button className="back" onClick={onExit}>← Exit</button>
          <div className="alwe-titles"><strong>{pkg.manifest.meta.topic}</strong><span>{pkg.manifest.meta.course}</span></div></div>
        <div className="alwe-resume">
          <p>Welcome back. Continue from <strong>{label}</strong>?</p>
          <div className="alwe-resume-actions">
            <button className="alwe-submit" onClick={() => { setResumeConsumedAt(resume.index); go(resume.index); }}>Continue</button>
            <button className="ghost" onClick={() => { setResume(null); setResumeConsumedAt(0); go(0); }}>Start over</button>
          </div>
        </div>
      </div>
    );
  }

  const node = ctrl.node;
  const scene = ctrl.sceneOf(node);
  const title = LessonController.labelFor(node, scene?.title);
  const initialElapsedMs = resume && resume.index === index ? resume.elapsedMs : 0;

  return (
    <div className="alwe-player">
      <div className="alwe-topbar">
        <button className="back" onClick={onExit}>← Exit</button>
        <div className="alwe-titles">
          <strong>{title}</strong>
          <span>{pkg.manifest.meta.course} · {pkg.manifest.meta.topic} · Step {index + 1} of {ctrl.count}</span>
        </div>
        <button className="alwe-outline-toggle" onClick={() => setOutlineOpen((o) => !o)} aria-expanded={outlineOpen}>☰ Scenes</button>
      </div>

      <div className="alwe-progress-dots" role="progressbar" aria-valuenow={index + 1} aria-valuemax={ctrl.count}>
        {ctrl.arc.map((_, i) => <span key={i} className={`dot ${i === index ? 'on' : i < index ? 'past' : ''}`} />)}
      </div>

      {outlineOpen && <LessonOutline ctrl={ctrl} currentIndex={index} onJump={go} />}

      {bookmarks.length > 0 && outlineOpen && (
        <div className="alwe-bookmarks">
          <span className="alwe-bookmarks-h">🔖 Bookmarks</span>
          {bookmarks.map((b, i) => (
            <button key={i} className="alwe-bookmark-chip" onClick={() => jumpToBookmark(b)}>
              {ctrl.pkg.scenes.find((s) => s.id === b.sceneId)?.title || b.sceneId} · {Math.round(b.atMs / 1000)}s
            </button>
          ))}
        </div>
      )}

      {scene ? (
        <SceneNode
          key={`${scene.id}:${epoch}`}
          scene={scene}
          initialElapsedMs={initialElapsedMs}
          autoPlay={!initialElapsedMs}
          speed={speed}
          onSpeedChange={setSpeed}
          onCompleted={(id) => { ctrl.markCompleted(id); bump(); }}
          onPersist={(ms) => persist(ms)}
          onBookmark={addBookmark}
        />
      ) : node.kind === 'miniQuiz' || node.kind === 'finalQuiz' ? (
        <QuizNode title={node.kind === 'finalQuiz' ? 'Final Quiz' : 'Mini Quiz'} quiz={node.quiz || []} />
      ) : (
        <NodeCard node={node} />
      )}

      <div className="alwe-nav">
        <button className="ghost" onClick={() => go(index - 1)} disabled={!ctrl.canPrev}>← Previous</button>
        {scene && <button className="ghost" onClick={() => { setResume({ index, elapsedMs: 0 }); go(index); }}>↺ Replay scene</button>}
        {ctrl.canNext
          ? <button className="alwe-next" onClick={next}>Next →</button>
          : <button className="alwe-next" onClick={onExit}>Finish ✓</button>}
      </div>
    </div>
  );
}
