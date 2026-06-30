// EFIKO ALWE — a single scene node: drawing stage + transport (play/pause, scrub, speed,
// bookmark) + synced caption, plus Batch-5 interactivity: smart pause points that halt the
// clock and ask a question, tap-to-explain that focuses an object, and a per-scene
// knowledge check after the scene finishes. Owns its own TimelineEngine + VoiceSync.
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Scene, AlweObject, PausePoint } from '../types';
import { TimelineEngine } from '../engine/TimelineEngine';
import { usePlayback } from '../hooks/usePlayback';
import { VoiceSync, segmentAt, offsetSeconds } from '../engine/VoiceSync';
import SceneStage from './SceneStage';
import PausePrompt from './PausePrompt';
import MiniCheck from './MiniCheck';

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
  onCheckResult?: (sceneId: string, correct: boolean, wrongConceptTags: string[]) => void;
  clipUrlFor?: (clipKey: string) => string | undefined;
}

export default function SceneNode(props: Props): ReactElement {
  const { scene, initialElapsedMs = 0, speed, autoPlay, onSpeedChange, onCompleted, onPersist, onBookmark, onCheckResult, clipUrlFor } = props;
  const engine = useMemo(() => { const e = new TimelineEngine(); e.load(scene); e.setSpeed(speed); if (initialElapsedMs) e.seek(initialElapsedMs); return e; }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const pb = usePlayback(engine);
  const completedRef = useRef(false);

  const [activePause, setActivePause] = useState<PausePoint | null>(null);
  const [focused, setFocused] = useState<{ id: string; text: string } | null>(null);
  const triggered = useRef<Set<number>>(new Set());
  const lastTime = useRef(initialElapsedMs);

  // Voice: an <audio> element driven by VoiceSync on discrete transitions only.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voice = useMemo(() => new VoiceSync((key) => clipUrlFor?.(key)), [clipUrlFor]);
  const seg = segmentAt(scene, engine.elapsedMs);
  const segId = seg?.id ?? null;
  useEffect(() => { voice.attach(audioRef.current); }, [voice]);
  useEffect(() => { voice.loadSegment(seg, seg ? offsetSeconds(seg, engine.elapsedMs) : 0, pb.playing); }, [segId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { voice.setPlaying(pb.playing); }, [pb.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { voice.setSpeed(pb.speed); }, [pb.speed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (seg) voice.seekTo(offsetSeconds(seg, engine.elapsedMs), pb.playing); }, [pb.seekNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart pause points: halt the clock the moment we cross an untriggered point.
  useEffect(() => {
    const prev = lastTime.current;
    const now = engine.elapsedMs;
    lastTime.current = now;
    if (!pb.playing || activePause) return;
    const idx = scene.pausePoints.findIndex((pp, i) => pp.atMs > 0 && pp.atMs > prev && pp.atMs <= now && !triggered.current.has(i));
    if (idx >= 0) { triggered.current.add(idx); pb.pause(); setActivePause(scene.pausePoints[idx]); }
  }, [pb.elapsedMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // On seek, clear focus/pause and let any pause points ahead of the new position re-fire.
  useEffect(() => {
    const now = engine.elapsedMs;
    const keep = new Set<number>();
    scene.pausePoints.forEach((pp, i) => { if (pp.atMs <= now && triggered.current.has(i)) keep.add(i); });
    triggered.current = keep;
    lastTime.current = now;
    setActivePause(null);
    setFocused(null);
  }, [pb.seekNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-play a freshly entered scene; mark completed once the timeline finishes.
  useEffect(() => { if (autoPlay) pb.play(); }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engine.isComplete() && !completedRef.current) { completedRef.current = true; onCompleted(scene.id); }
  });
  useEffect(() => { if (!pb.playing) onPersist(engine.elapsedMs); }, [pb.playing, pb.elapsedMs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPersist(engine.elapsedMs), []); // eslint-disable-line react-hooks/exhaustive-deps

  const states = engine.states();
  const segText = seg?.text || '';

  function onTap(obj: AlweObject): void {
    pb.pause();
    setFocused({ id: obj.id, text: obj.onTapExplain || obj.explainText || '' });
  }
  function continuePause(): void { setActivePause(null); pb.play(); }

  const showCheck = engine.isComplete() && scene.knowledgeCheck;

  return (
    <>
      <audio ref={audioRef} preload="auto" hidden />
      <p className="alwe-objective">🎯 {scene.objective}</p>
      <SceneStage scene={scene} states={states} onObjectTap={onTap} focusedId={focused?.id} />

      {activePause ? (
        <PausePrompt pause={activePause} onContinue={continuePause} />
      ) : focused ? (
        <div className="alwe-focus">
          <button className="alwe-focus-close" onClick={() => setFocused(null)} aria-label="Close">×</button>
          <p>{focused.text || 'Tap explored.'}</p>
        </div>
      ) : (
        <p className="alwe-caption" aria-live="polite">{segText || ' '}</p>
      )}

      <div className="alwe-controls">
        <button className="alwe-play" onClick={pb.toggle} aria-label={pb.playing ? 'Pause' : 'Play'} disabled={!!activePause}>
          {pb.playing ? '⏸' : engine.isComplete() ? '↺' : '▶'}
        </button>
        <input
          className="alwe-scrub" type="range" min={0} max={pb.durationMs} step={50}
          value={pb.elapsedMs} onChange={(e) => { pb.pause(); pb.seek(Number(e.target.value)); }}
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

      {!focused && scene.objects.some((o) => o.interactive) && (
        <p className="alwe-hint">💡 Tip: tap a labelled part of the diagram to explore it.</p>
      )}

      {showCheck && scene.knowledgeCheck && (
        <div className="alwe-kc">
          <span className="alwe-kc-h">✅ Check your understanding</span>
          <MiniCheck check={scene.knowledgeCheck} onResult={(c, tags) => onCheckResult?.(scene.id, c, tags)} />
        </div>
      )}
    </>
  );
}
