// EFIKO ALWE — Timeline Engine. The master clock for one scene.
// Core property (see docs/ALWE-ARCHITECTURE.md §5): every object's on-screen state is a
// PURE function of elapsed time — `stateOf(obj, elapsedMs)`. Because of that, play, pause,
// seek, replay and resume are all the same operation: set elapsedMs and recompute.
import type { Scene, AlweObject } from '../types';
import { ease, clamp01 } from '../util/easing';

export interface ObjectRenderState {
  visible: boolean;
  drawProgress: number; // 0..1 for stroke draw-on
  opacity: number;      // 0..1
  highlight: boolean;
}

const HIDDEN: ObjectRenderState = { visible: false, drawProgress: 0, opacity: 0, highlight: false };

export class TimelineEngine {
  scene: Scene | null = null;
  durationMs = 0;
  elapsedMs = 0;
  speed = 1;

  load(scene: Scene): void {
    this.scene = scene;
    this.elapsedMs = 0;
    this.durationMs = TimelineEngine.computeDuration(scene);
  }

  /** Scene length = the latest of: object animations, narration, pause points, estimate. */
  static computeDuration(scene: Scene): number {
    let end = scene.estimatedMs || 0;
    for (const o of scene.objects) end = Math.max(end, o.animation.startMs + o.animation.durationMs);
    for (const s of scene.segments) end = Math.max(end, s.endMs);
    for (const p of scene.pausePoints) end = Math.max(end, p.atMs);
    return Math.max(end, 1);
  }

  setSpeed(x: number): void {
    this.speed = x > 0 ? x : 1;
  }

  seek(ms: number): void {
    this.elapsedMs = ms < 0 ? 0 : ms > this.durationMs ? this.durationMs : ms;
  }

  /** Advance by real wall-clock delta (ms), scaled by speed. Returns the new elapsed. */
  advance(dtMs: number): number {
    this.seek(this.elapsedMs + dtMs * this.speed);
    return this.elapsedMs;
  }

  isComplete(): boolean {
    return this.elapsedMs >= this.durationMs;
  }

  /** Pure: an object's render state at the current elapsed time. */
  stateOf(obj: AlweObject): ObjectRenderState {
    const { startMs, durationMs, kind, easing } = obj.animation;
    if (this.elapsedMs < startMs) return HIDDEN;
    const raw = clamp01((this.elapsedMs - startMs) / Math.max(durationMs, 1));
    const p = ease(easing, raw);
    switch (kind) {
      case 'draw':
        return { visible: true, drawProgress: p, opacity: 1, highlight: false };
      case 'appear':
      case 'fade':
      case 'move':
        return { visible: true, drawProgress: 1, opacity: p, highlight: false };
      case 'dim':
        return { visible: true, drawProgress: 1, opacity: 1 - 0.6 * p, highlight: false };
      case 'highlight':
        return { visible: true, drawProgress: 1, opacity: 1, highlight: true };
      default:
        return { visible: true, drawProgress: 1, opacity: 1, highlight: false };
    }
  }

  /** All object states keyed by object id (what the renderer consumes each frame). */
  states(): Map<string, ObjectRenderState> {
    const m = new Map<string, ObjectRenderState>();
    if (!this.scene) return m;
    for (const o of this.scene.objects) m.set(o.id, this.stateOf(o));
    return m;
  }

  /** The voice segment that owns the current time (for VoiceSync / captions in later batches). */
  currentSegmentId(): string | null {
    if (!this.scene) return null;
    const seg = this.scene.segments.find((s) => this.elapsedMs >= s.startMs && this.elapsedMs < s.endMs);
    return seg ? seg.id : null;
  }
}
