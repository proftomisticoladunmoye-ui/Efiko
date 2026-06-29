// EFIKO ALWE — a single scene node: the drawing stage + transport (play/pause, scrub,
// speed, bookmark) + synced caption. Owns its own TimelineEngine for the scene; reports
// position up so the lesson can persist resume state and bookmarks.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Scene, AlweObject } from '../types';
import { TimelineEngine } from '../engine/TimelineEngine';
import { usePlayback } from '../hooks/usePlayback';
import SceneStage from './SceneStage';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const fmt = (ms: number): string => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

interface Props {
  scene: Scene;
  initialElapsedMs?: number;
  speed: number;
  autoPlay?: boolean;
  onSpeedChange: (x: number) => void;
  onCompleted: (sceneId: string) => void;
  onPersist: (elapsedMs: number) => void;
  onBookmark: (sceneId: string, atMs: number) => void;
}

export default function SceneNode(props: Props): ReactElement {
  const { scene, initialElapsedMs = 0, speed, autoPlay, onSpeedChange, onCompleted, onPersist, onBookmark } = props;
  const engine = useMemo(() => { const e = new TimelineEngine(); e.load(scene); e.setSpeed(speed); if (initialElapsedMs) e.seek(initialElapsedMs); return e; }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const pb = usePlayback(engine);
  const [tapped, setTapped] = useState<string | null>(null);
  const completedRef = useRef(false);

  // Auto-play a freshly entered scene; mark completed once the timeline finishes.
  useEffect(() => { if (autoPlay) pb.play(); }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engine.isComplete() && !completedRef.current) { completedRef.current = true; onCompleted(scene.id); }
  });
  // Persist position whenever it stops moving (pause/seek) and on unmount.
  useEffect(() => { if (!pb.playing) onPersist(engine.elapsedMs); }, [pb.playing, pb.elapsedMs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPersist(engine.elapsedMs), []); // eslint-disable-line react-hooks/exhaustive-deps

  const states = engine.states();
  const segId = engine.currentSegmentId();
  const segText = scene.segments.find((s) => s.id === segId)?.text || '';
  const caption = tapped || segText;
  const onTap = (obj: AlweObject) => setTapped(obj.onTapExplain || obj.explainText || null);

  return (
    <>
      <p className="alwe-objective">🎯 {scene.objective}</p>
      <SceneStage scene={scene} states={states} onObjectTap={onTap} />
      <p className="alwe-caption" aria-live="polite">{caption || ' '}</p>
      <div className="alwe-controls">
        <button className="alwe-play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'}>
          {pb.playing ? '⏸' : engine.isComplete() ? '↺' : '▶'}
        </button>
        <input
          className="alwe-scrub" type="range" min={0} max={pb.durationMs} step={50}
          value={pb.elapsedMs} onChange={(e) => { pb.pause(); pb.seek(Number(e.target.value)); setTapped(null); }}
          aria-label="Scrub scene timeline"
        />
        <span className="alwe-time">{fmt(pb.elapsedMs)} / {fmt(pb.durationMs)}</span>
        <select
          className="alwe-speed" value={speed} aria-label="Playback speed"
          onChange={(e) => { const x = Number(e.target.value); pb.setSpeed(x); onSpeedChange(x); }}
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        <button className="alwe-bookmark" onClick={() => onBookmark(scene.id, engine.elapsedMs)} title="Bookmark this moment" aria-label="Bookmark">🔖</button>
      </div>
    </>
  );
}
