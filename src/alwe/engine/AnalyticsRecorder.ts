// EFIKO ALWE — local learning analytics. Records behaviour (quiz results per concept,
// scene completion, replays, help requests, dwell, speed) into IndexedDB. Fully offline;
// feeds the Cognitive Tutor / AI Study Coach in Batch 8. See ARCHITECTURE §"Learning Analytics".
import type { LessonAnalytics } from '../types';
import { getAnalytics, saveAnalytics } from '../store/PackageStore';

export function emptyAnalytics(lessonId: string): LessonAnalytics {
  return {
    lessonId,
    scenesCompleted: 0,
    replayCountByScene: {},
    dwellMsByScene: {},
    quizByConcept: {},
    replayedObjects: {},
    avgSpeed: 1,
    helpRequests: 0,
    updatedAt: Date.now()
  };
}

export class AnalyticsRecorder {
  data: LessonAnalytics;
  private completed = new Set<string>();
  private speeds: number[] = [];

  constructor(lessonId: string, data?: LessonAnalytics) {
    this.data = data ?? emptyAnalytics(lessonId);
  }

  static async load(lessonId: string): Promise<AnalyticsRecorder> {
    return new AnalyticsRecorder(lessonId, await getAnalytics(lessonId));
  }

  recordQuiz(conceptTags: string[], correct: boolean): void {
    for (const t of conceptTags) {
      const c = this.data.quizByConcept[t] ?? { correct: 0, total: 0 };
      c.total += 1;
      if (correct) c.correct += 1;
      this.data.quizByConcept[t] = c;
    }
    this.persist();
  }

  recordSceneCompleted(sceneId: string): void {
    if (this.completed.has(sceneId)) return;
    this.completed.add(sceneId);
    this.data.scenesCompleted = this.completed.size;
    this.persist();
  }

  recordReplay(sceneId: string): void {
    this.data.replayCountByScene[sceneId] = (this.data.replayCountByScene[sceneId] || 0) + 1;
    this.recomputeHardest();
    this.persist();
  }

  recordDwell(sceneId: string, ms: number): void {
    if (ms <= 0) return;
    this.data.dwellMsByScene[sceneId] = (this.data.dwellMsByScene[sceneId] || 0) + ms;
    this.persist();
  }

  recordHelp(): void {
    this.data.helpRequests += 1;
    this.persist();
  }

  recordSpeed(x: number): void {
    this.speeds.push(x);
    this.data.avgSpeed = this.speeds.reduce((a, b) => a + b, 0) / this.speeds.length;
  }

  /** Hardest = most-replayed scene (a coarse proxy the tutor refines in Batch 8). */
  private recomputeHardest(): void {
    let max = -1;
    let id: string | undefined;
    for (const [s, n] of Object.entries(this.data.replayCountByScene)) {
      if (n > max) { max = n; id = s; }
    }
    this.data.hardestSceneId = id;
  }

  private persist(): void {
    this.data.updatedAt = Date.now();
    void saveAnalytics(this.data);
  }
}
