// EFIKO ALWE — Learning Modes. Fast / Normal / Deep change pacing and depth WITHOUT a
// re-download: the same package is filtered/augmented at play time. See ARCHITECTURE §"Learning Modes".
import type { LearningMode, AlweObject } from '../types';

export const MODES: { id: LearningMode; label: string; hint: string }[] = [
  { id: 'fast', label: 'Fast', hint: 'Quick review — essentials, no pauses' },
  { id: 'normal', label: 'Normal', hint: 'Standard pacing with pauses & checks' },
  { id: 'deep', label: 'Deep', hint: 'Extra examples + African context, all pauses' }
];

// Fast trims the friction (no halts, no end check, no tips); Deep adds depth.
export const showPausePoints = (m: LearningMode): boolean => m !== 'fast';
export const showKnowledgeCheck = (m: LearningMode): boolean => m !== 'fast';
export const showHints = (m: LearningMode): boolean => m !== 'fast';
export const showDeepExtra = (m: LearningMode): boolean => m === 'deep';

/** An object is shown in a mode unless it explicitly opts into a subset that excludes it. */
export const objectInMode = (o: AlweObject, m: LearningMode): boolean => !o.modes || o.modes.includes(m);
