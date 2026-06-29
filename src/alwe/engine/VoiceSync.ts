// EFIKO ALWE — Voice synchronisation. Controls an <audio> element so the right narration
// clip plays as the timeline reaches its segment. The timeline clock stays master: this
// only acts on discrete transitions (segment change, play/pause, speed, seek), never per
// frame — so it doesn't fight playback. Missing clip → silent (captions still carry the
// scene), keeping voice an enhancement, not a requirement. See ARCHITECTURE §11.
import type { Scene, VoiceSegment } from '../types';

/** The stored clip key for a segment (clipId once voiced, else the segment id). */
export function clipKeyOf(seg: VoiceSegment): string {
  return seg.clipId || seg.id;
}

export function segmentAt(scene: Scene, elapsedMs: number): VoiceSegment | null {
  return scene.segments.find((s) => elapsedMs >= s.startMs && elapsedMs < s.endMs) ?? null;
}

/** Seconds into the current clip for a given timeline position. */
export function offsetSeconds(seg: VoiceSegment, elapsedMs: number): number {
  return Math.max(0, (elapsedMs - seg.startMs) / 1000);
}

export class VoiceSync {
  private audio: HTMLAudioElement | null = null;
  private currentKey: string | null = null;
  private resolve: (clipKey: string) => string | undefined;

  constructor(resolve: (clipKey: string) => string | undefined) {
    this.resolve = resolve;
  }

  attach(audio: HTMLAudioElement | null): void { this.audio = audio; }

  /** Point the element at a segment's clip and seek to the right offset. */
  loadSegment(seg: VoiceSegment | null, offsetSec: number, playing: boolean): void {
    if (!this.audio) return;
    const url = seg ? this.resolve(clipKeyOf(seg)) : undefined;
    if (!seg || !url) { this.audio.pause(); this.currentKey = null; return; }
    const key = clipKeyOf(seg);
    if (this.currentKey !== key) { this.audio.src = url; this.currentKey = key; }
    this.setCurrentTime(offsetSec);
    if (playing) void this.audio.play().catch(() => {});
  }

  setPlaying(playing: boolean): void {
    if (!this.audio || !this.currentKey) return;
    if (playing) void this.audio.play().catch(() => {});
    else this.audio.pause();
  }

  setSpeed(x: number): void { if (this.audio) this.audio.playbackRate = x; }

  seekTo(offsetSec: number, playing: boolean): void {
    if (!this.audio || !this.currentKey) return;
    this.setCurrentTime(offsetSec);
    if (playing) void this.audio.play().catch(() => {});
  }

  private setCurrentTime(sec: number): void {
    if (!this.audio) return;
    try { this.audio.currentTime = sec; } catch { /* not ready yet; will apply on next load */ }
  }
}
