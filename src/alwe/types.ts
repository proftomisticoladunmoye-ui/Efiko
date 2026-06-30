// EFIKO — Adaptive Learning Whiteboard Engine (ALWE) data model.
// Single source of truth for the lesson/scene/object contract. The server-side
// validator (server/core/alwe/schema.js) mirrors these shapes at runtime.
// See docs/ALWE-ARCHITECTURE.md §15.

export type ObjectType =
  | 'text' | 'arrow' | 'circle' | 'rectangle' | 'triangle' | 'line'
  | 'graph' | 'table' | 'chart' | 'equation' | 'coordinatePlane'
  | 'timeline' | 'flowchart' | 'icon' | 'label' | 'highlight'
  | 'underline' | 'pointer';

export type AnimationKind = 'appear' | 'draw' | 'highlight' | 'fade' | 'move' | 'dim';
export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
export type LearningMode = 'fast' | 'normal' | 'deep';
export type Difficulty = 'intro' | 'core' | 'stretch';

export interface AlweAnimation {
  kind: AnimationKind;
  startMs: number;        // on the scene clock
  durationMs: number;
  easing?: Easing;
}

/** Pre-generated at publish time so every variant is available fully offline. */
export interface ExplainBundle {
  simpler: string;
  detailed: string;
  practicalExample: string;
  africanContext: string;
  realLifeScenario: string;
  visualAnalogy: string;
  commonMistakes: string;
  memoryTip: string;
}

export interface AlweObject {
  id: string;                       // unique within lesson; the *type* is reusable across lessons
  type: ObjectType;
  props: Record<string, unknown>;   // geometry/styling per type (typed per renderer in objects/)
  animation: AlweAnimation;
  explainText?: string;             // one-line "what this is"
  voiceSegmentId?: string;          // segment that narrates this object
  conceptTags?: string[];           // links object → concept → quiz item (adaptive replay / tutor)
  interactive?: boolean;
  onTapExplain?: string;            // shown/narrated when tapped
  modes?: LearningMode[];           // which modes include this object (default: all)
}

export interface VoiceSegment {
  id: string;
  sceneId: string;
  startMs: number;
  endMs: number;                    // position on the scene clock
  text: string;                     // caption + a11y + TTS source
  clipId: string | null;           // → alwe_clips blob; null until voiced (Batch 4)
  bytes?: number;
}

export interface KnowledgeCheck {
  q: string;
  options: string[];
  answer: number;                   // index into options
  conceptTags?: string[];           // a wrong answer → adaptive replay target
}

export interface PausePoint {
  atMs: number;
  prompt: string;                   // e.g. "Why is the X-axis drawn first?"
  expectKind?: 'reflect' | 'tapObject' | 'mcq';
  answer?: KnowledgeCheck;          // optional gate before resuming
}

/** Teach Back (protégé effect): the learner explains the concept in their own words and
 *  the system evaluates it. Pre-generated so an offline recall check works; online, Claude
 *  grades the free text against this rubric. See ARCHITECTURE §21. */
export interface TeachBackRubric {
  prompt: string;                   // "Explain in your own words why b is the difficulty."
  expectedPoints: string[];         // key ideas a strong answer covers (offline recall check)
  commonGaps?: string[];            // what learners typically miss (hints)
}

export interface Scene {
  id: string;
  title: string;
  objective: string;
  estimatedMs: number;
  difficulty: Difficulty;
  objects: AlweObject[];
  segments: VoiceSegment[];
  pausePoints: PausePoint[];
  knowledgeCheck?: KnowledgeCheck;
  teachBack?: TeachBackRubric;
  explain: ExplainBundle;           // scene-level Explain Again
  replay?: { prerequisiteSceneId?: string };
}

export type StructuralKind =
  | 'intro' | 'scene' | 'miniQuiz' | 'reflection' | 'summary' | 'finalQuiz';

/** One ordered step in the lesson arc. */
export interface LessonNode {
  kind: StructuralKind;
  sceneId?: string;                 // for kind:'scene'
  title?: string;                   // for structural nodes (intro/reflection/summary)
  body?: string;                    // narration/notes for structural nodes
  quiz?: KnowledgeCheck[];          // for miniQuiz / finalQuiz nodes
}

export interface LessonMeta {
  university: string;
  course: string;
  topic: string;
  level?: string;
  sequence?: number;
}

export interface LessonManifest {
  lessonId: string;
  format: 'alwe';
  version: number;
  meta: LessonMeta;
  arc: LessonNode[];
  totalBytesEstimate: number;
  defaultMode: LearningMode;
  offlineReady: boolean;
}

export interface LessonPackage {
  manifest: LessonManifest;
  scenes: Scene[];                  // resolved scenes referenced by arc nodes
}

// ---- client-only state (IndexedDB; never shipped in the package) ----

export interface Bookmark {
  sceneId: string;
  atMs: number;
  note?: string;
}

export interface LessonProgress {
  lessonId: string;
  lastNodeIndex: number;            // position in manifest.arc (resume point)
  lastSceneId: string;
  lastElapsedMs: number;
  speed: number;
  mode: LearningMode;
  completedSceneIds: string[];
  bookmarks: Bookmark[];
  updatedAt: number;
}

export interface LessonAnalytics {
  lessonId: string;
  scenesCompleted: number;
  replayCountByScene: Record<string, number>;
  dwellMsByScene: Record<string, number>;
  quizByConcept: Record<string, { correct: number; total: number }>;
  replayedObjects: Record<string, number>;
  avgSpeed: number;
  helpRequests: number;
  hardestSceneId?: string;          // derived
  updatedAt: number;
}

/** A stored, downloaded package plus its offline bookkeeping. */
export interface StoredPackage extends LessonPackage {
  lessonId: string;                 // mirror of manifest.lessonId (IndexedDB keyPath)
  pinned: boolean;
  version: number;
  savedAt: number;
  updatedAt: number;
}

export interface StoredClip {
  lessonId: string;
  clipId: string;
  blob: Blob;
  mime: string;
  bytes: number;
  savedAt: number;
}
