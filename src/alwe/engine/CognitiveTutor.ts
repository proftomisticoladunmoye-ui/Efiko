// EFIKO ALWE — Cognitive Tutor / AI Study Coach. A transparent, OFFLINE rule model over
// the local analytics: it diagnoses per-concept mastery and proposes specific, scene-scoped
// next steps (not just a score). Online, the UI can escalate one insight to Claude for a
// fresh explanation. See ARCHITECTURE §17. Designed to be explainable — fitting a
// psychometrician's product: every nudge traces to a concrete signal.
import type { LessonPackage, LessonAnalytics } from '../types';
import { sceneTeaching } from './adaptiveReplay';

export type InsightKind = 'weakConcept' | 'replayHeavy' | 'mastered';

export interface TutorInsight {
  kind: InsightKind;
  message: string;          // the coach's sentence
  sceneId?: string;         // scene to act on
  sceneTitle?: string;
  concept?: string;         // conceptTag (for online escalation)
  detailLabel?: string;     // e.g. "Show a simpler explanation"
  detail?: string;          // the pre-generated explanation to reveal (offline)
}

const MASTERY_THRESHOLD = 0.67; // below this on attempted items → still shaky

function humanize(tag: string): string {
  const s = tag.replace(/[-_]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Diagnose from analytics + package → ordered list of actionable insights. */
export function diagnose(analytics: LessonAnalytics | null | undefined, pkg: LessonPackage): TutorInsight[] {
  if (!analytics) return [];
  const insights: TutorInsight[] = [];

  // 1) Weak concepts — worst first, scene-scoped, with a simpler explanation to reveal.
  const weak = Object.entries(analytics.quizByConcept)
    .filter(([, c]) => c.total > 0 && c.correct / c.total < MASTERY_THRESHOLD)
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total);

  const usedScenes = new Set<string>();
  for (const [tag, c] of weak.slice(0, 2)) {
    const sceneId = sceneTeaching(pkg, tag);
    const scene = pkg.scenes.find((s) => s.id === sceneId);
    if (!scene || usedScenes.has(scene.id)) continue;
    usedScenes.add(scene.id);
    insights.push({
      kind: 'weakConcept',
      message: `You missed "${humanize(tag)}" (${c.correct}/${c.total}). Let's revisit ${scene.title} rather than the whole lesson.`,
      sceneId: scene.id,
      sceneTitle: scene.title,
      concept: tag,
      detailLabel: 'Show a simpler explanation',
      detail: scene.explain.simpler
    });
  }

  // 2) Heavy replays — offer a different angle (African example).
  for (const [sceneId, n] of Object.entries(analytics.replayCountByScene)) {
    if (n < 2 || usedScenes.has(sceneId)) continue;
    const scene = pkg.scenes.find((s) => s.id === sceneId);
    if (!scene) continue;
    usedScenes.add(sceneId);
    insights.push({
      kind: 'replayHeavy',
      message: `You've replayed ${scene.title} ${n} times — a different angle might click.`,
      sceneId,
      sceneTitle: scene.title,
      detailLabel: 'Show an African example',
      detail: scene.explain.africanContext
    });
  }

  // 3) Doing well — encourage, only when there's evidence and nothing to fix.
  if (insights.length === 0) {
    const attempted = Object.values(analytics.quizByConcept);
    if (attempted.length > 0 && attempted.every((c) => c.correct / c.total >= MASTERY_THRESHOLD)) {
      insights.push({ kind: 'mastered', message: 'Strong work — your answers show solid understanding. Keep going!' });
    }
  }

  return insights;
}
