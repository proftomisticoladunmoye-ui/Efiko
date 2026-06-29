// EFIKO ALWE — easing functions (hand-rolled; no animation library, a few bytes).
import type { Easing } from '../types';

export const easings: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
};

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export function ease(kind: Easing | undefined, t: number): number {
  return (easings[kind ?? 'linear'] ?? easings.linear)(clamp01(t));
}
