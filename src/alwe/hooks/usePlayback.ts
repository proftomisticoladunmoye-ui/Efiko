// EFIKO ALWE — playback loop. Drives the TimelineEngine with a requestAnimationFrame
// clock and exposes transport state to React. Auto-pauses when the tab is hidden (saves
// battery on low-end Android). Full controls/scene-nav formalise in Batch 3.
import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import type { TimelineEngine } from '../engine/TimelineEngine';

export interface Playback {
  elapsedMs: number;
  durationMs: number;
  playing: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number) => void;
  setSpeed: (x: number) => void;
}

export function usePlayback(engine: TimelineEngine): Playback {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(engine.speed);
  const last = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const loop = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      engine.advance(dt);
      force();
      if (engine.isComplete()) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, engine]);

  // Pause when the tab/app goes to the background.
  useEffect(() => {
    const onHide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const play = useCallback(() => {
    if (engine.isComplete()) engine.seek(0); // replay from start when finished
    setPlaying(true);
  }, [engine]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const seek = useCallback((ms: number) => { engine.seek(ms); force(); }, [engine]);
  const setSpeed = useCallback((x: number) => { engine.setSpeed(x); setSpeedState(x); }, [engine]);

  return { elapsedMs: engine.elapsedMs, durationMs: engine.durationMs, playing, speed, play, pause, toggle, seek, setSpeed };
}
