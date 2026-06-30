// EFIKO ALWE — Adaptive Replay + Explain My Mistake (pure, testable). Maps a missed
// concept to the scene that taught it and to that scene's misconception explanation, so
// help is always scene-scoped (never a full-lesson replay). See ARCHITECTURE §9 & §"Explain My Mistake".
import type { LessonPackage } from '../types';

/** The first scene that teaches a concept (its knowledge check or any tagged object). */
export function sceneTeaching(pkg: LessonPackage, conceptTag: string): string | null {
  for (const s of pkg.scenes) {
    if (s.knowledgeCheck?.conceptTags?.includes(conceptTag)) return s.id;
    if (s.objects.some((o) => o.conceptTags?.includes(conceptTag))) return s.id;
  }
  return null;
}

export interface MistakeItem {
  sceneId: string;
  sceneTitle: string;
  commonMistakes: string;
  simpler: string;
  concepts: string[];
}

/** Group missed concepts by the scene that teaches them → one targeted card per scene. */
export function explainMistakes(pkg: LessonPackage, wrongConceptTags: string[]): MistakeItem[] {
  const bySceneId = new Map<string, MistakeItem>();
  for (const tag of wrongConceptTags) {
    const sceneId = sceneTeaching(pkg, tag);
    if (!sceneId) continue;
    const scene = pkg.scenes.find((s) => s.id === sceneId);
    if (!scene) continue;
    const existing = bySceneId.get(sceneId);
    if (existing) { if (!existing.concepts.includes(tag)) existing.concepts.push(tag); continue; }
    bySceneId.set(sceneId, {
      sceneId,
      sceneTitle: scene.title,
      commonMistakes: scene.explain.commonMistakes,
      simpler: scene.explain.simpler,
      concepts: [tag]
    });
  }
  return [...bySceneId.values()];
}

/** A single scene's own mistake card (for the per-scene knowledge check). */
export function mistakeForScene(pkg: LessonPackage, sceneId: string): MistakeItem | null {
  const scene = pkg.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  return { sceneId, sceneTitle: scene.title, commonMistakes: scene.explain.commonMistakes, simpler: scene.explain.simpler, concepts: [] };
}
