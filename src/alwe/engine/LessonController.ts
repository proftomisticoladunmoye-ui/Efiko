// EFIKO ALWE — Lesson Controller. Pure, testable navigation over a lesson's arc
// (Intro → scenes → mini-quiz → … → final quiz). Holds no React state and does no I/O;
// the useLesson hook wraps it with state + IndexedDB persistence. See ARCHITECTURE §7.
import type { LessonPackage, LessonNode, Scene, LearningMode, LessonProgress } from '../types';

export class LessonController {
  readonly pkg: LessonPackage;
  readonly arc: LessonNode[];
  index = 0;
  completed = new Set<string>();

  constructor(pkg: LessonPackage) {
    this.pkg = pkg;
    this.arc = pkg.manifest.arc;
  }

  get count(): number { return this.arc.length; }
  get node(): LessonNode { return this.arc[this.index]; }
  get canPrev(): boolean { return this.index > 0; }
  get canNext(): boolean { return this.index < this.arc.length - 1; }

  /** The Scene for the current node, or null for structural / quiz nodes. */
  sceneOf(node: LessonNode = this.node): Scene | null {
    if (node.kind !== 'scene' || !node.sceneId) return null;
    return this.pkg.scenes.find((s) => s.id === node.sceneId) ?? null;
  }

  goTo(i: number): void {
    this.index = i < 0 ? 0 : i >= this.arc.length ? this.arc.length - 1 : i;
  }
  next(): void { this.goTo(this.index + 1); }
  prev(): void { this.goTo(this.index - 1); }

  markCompleted(sceneId: string): void { this.completed.add(sceneId); }
  isCompleted(sceneId: string): boolean { return this.completed.has(sceneId); }

  /** Human label for a node (used by the outline + progress readout). */
  static labelFor(node: LessonNode, sceneTitle?: string): string {
    switch (node.kind) {
      case 'intro': return node.title || 'Introduction';
      case 'scene': return sceneTitle || node.title || 'Scene';
      case 'miniQuiz': return 'Mini Quiz';
      case 'reflection': return node.title || 'Reflection';
      case 'summary': return node.title || 'Summary';
      case 'finalQuiz': return 'Final Quiz';
      default: return 'Step';
    }
  }

  toProgress(lessonId: string, opts: { elapsedMs: number; speed: number; mode: LearningMode; bookmarks: LessonProgress['bookmarks'] }): LessonProgress {
    return {
      lessonId,
      lastNodeIndex: this.index,
      lastSceneId: this.sceneOf()?.id ?? '',
      lastElapsedMs: opts.elapsedMs,
      speed: opts.speed,
      mode: opts.mode,
      completedSceneIds: [...this.completed],
      bookmarks: opts.bookmarks,
      updatedAt: Date.now()
    };
  }
}
