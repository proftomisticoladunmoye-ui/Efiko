// EFIKO ALWE — Studio authoring API (talks to the gateway).
import type { LessonPackage } from '../types';
import { aiHeaders, notifyAiUsed } from '../../aiClient.js';

const GATEWAY = (import.meta.env.VITE_GATEWAY as string) || 'http://localhost:4100';

export interface LessonRow {
  lessonId: string; university: string; course: string; topic: string; scenes: number; publishedAt: number;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `request failed (${res.status})`);
  return data as T;
}

export async function generateLesson(input: { topic: string; course?: string; university?: string; level?: string }): Promise<LessonPackage> {
  const res = await fetch(`${GATEWAY}/alwe/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...aiHeaders() } as Record<string, string>, body: JSON.stringify(input)
  });
  notifyAiUsed();
  const { pkg } = await jsonOrThrow<{ pkg: LessonPackage }>(res);
  return pkg;
}

export async function publishLesson(pkg: LessonPackage): Promise<string> {
  // Publishing requires an institution login (token saved by the Institution Admin panel).
  const token = localStorage.getItem('efiko-admin-token') || '';
  const res = await fetch(`${GATEWAY}/alwe/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ pkg })
  });
  const { lessonId } = await jsonOrThrow<{ lessonId: string }>(res);
  return lessonId;
}

export async function listLessons(): Promise<LessonRow[]> {
  try {
    const { lessons } = await jsonOrThrow<{ lessons: LessonRow[] }>(await fetch(`${GATEWAY}/alwe/lessons`));
    return lessons;
  } catch { return []; }
}
