// EFIKO ALWE — minimal player (Batch 2 vertical slice): load a lesson package, play its
// first scene on the timeline with play/pause, scrub, speed, and synced captions. Scene
// navigation, voice audio, interactions and adaptive features arrive in later batches.
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { LessonPackage, Scene, AlweObject } from '../types';
import { TimelineEngine } from '../engine/TimelineEngine';
import { usePlayback } from '../hooks/usePlayback';
import { savePackage, getPackage } from '../store/PackageStore';
import SceneStage from './SceneStage';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function loadPackage(lessonId: string): Promise<LessonPackage> {
  const stored = await getPackage(lessonId);
  if (stored) return stored;
  const res = await fetch(`/alwe/${lessonId}.json`);
  if (!res.ok) throw new Error(`Lesson "${lessonId}" not found`);
  const pkg = (await res.json()) as LessonPackage;
  await savePackage(pkg, { pinned: true }); // pin on first open so it's offline next time
  return pkg;
}

function firstScene(pkg: LessonPackage): Scene | null {
  const node = pkg.manifest.arc.find((n) => n.kind === 'scene' && n.sceneId);
  const id = node?.sceneId;
  return pkg.scenes.find((s) => s.id === id) ?? pkg.scenes[0] ?? null;
}

export default function AlwenPlayer({ lessonId, onExit }: { lessonId: string; onExit?: () => void }): ReactElement {
  const [pkg, setPkg] = useState<LessonPackage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tapped, setTapped] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPackage(lessonId).then((p) => { if (!cancelled) setPkg(p); }).catch((e) => !cancelled && setErr(e.message));
    return () => { cancelled = true; };
  }, [lessonId]);

  const scene = useMemo(() => (pkg ? firstScene(pkg) : null), [pkg]);
  const engine = useMemo(() => { const e = new TimelineEngine(); if (scene) e.load(scene); return e; }, [scene]);
  const pb = usePlayback(engine);

  if (err) return <div className="alwe-player"><p className="error">{err}</p><button className="back" onClick={onExit}>← Back</button></div>;
  if (!pkg || !scene) return <div className="alwe-player"><p className="alwe-loading">Loading lesson…</p></div>;

  const states = engine.states();
  const segId = engine.currentSegmentId();
  const segText = scene.segments.find((s) => s.id === segId)?.text || '';
  const caption = tapped || segText;

  const onTap = (obj: AlweObject) => setTapped(obj.onTapExplain || obj.explainText || null);

  return (
    <div className="alwe-player">
      <div className="alwe-topbar">
        <button className="back" onClick={onExit}>← Exit</button>
        <div className="alwe-titles">
          <strong>{scene.title}</strong>
          <span>{pkg.manifest.meta.course} · {pkg.manifest.meta.topic}</span>
        </div>
      </div>

      <p className="alwe-objective">🎯 {scene.objective}</p>

      <SceneStage scene={scene} states={states} onObjectTap={onTap} />

      <p className="alwe-caption" aria-live="polite">{caption || ' '}</p>

      <div className="alwe-controls">
        <button className="alwe-play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
          {pb.playing ? '⏸' : engine.isComplete() ? '↺' : '▶'}
        </button>
        <input
          className="alwe-scrub" type="range" min={0} max={pb.durationMs} step={50}
          value={pb.elapsedMs} onChange={(e) => { pb.pause(); pb.seek(Number(e.target.value)); setTapped(null); }}
          aria-label="Scrub timeline"
        />
        <span className="alwe-time">{fmt(pb.elapsedMs)} / {fmt(pb.durationMs)}</span>
        <select className="alwe-speed" value={pb.speed} onChange={(e) => pb.setSpeed(Number(e.target.value))} aria-label="Playback speed">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>
    </div>
  );
}
