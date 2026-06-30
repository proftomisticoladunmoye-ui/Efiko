// EFIKO ALWE — student-facing list of Adaptive Whiteboard lessons for the Library.
// Offline-aware: shows lessons already downloaded (IndexedDB), the bundled sample, and —
// when online — lessons lecturers have published on the gateway. Opening one routes to
// the lazy-loaded player via ?alwe=<id>. Kept light so it doesn't pull the engine chunk.
import { useEffect, useState, type ReactElement } from 'react';
import { listPackages } from '../store/PackageStore';
import { listLessons } from '../net/authoring';

interface Row { lessonId: string; topic: string; course: string; university: string; offline: boolean; }

const SAMPLE: Row = { lessonId: 'kiu-psy720-irt-alwe', topic: 'Item Response Theory', course: 'PSY720', university: 'KIU', offline: false };

function openLesson(id: string): void {
  window.location.href = `${window.location.pathname}?alwe=${encodeURIComponent(id)}`;
}

export default function AlweLessons(): ReactElement | null {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const byId = new Map<string, Row>();
      // Downloaded packages → offline-ready.
      for (const p of await listPackages()) {
        byId.set(p.lessonId, { lessonId: p.lessonId, topic: p.manifest.meta.topic, course: p.manifest.meta.course, university: p.manifest.meta.university, offline: true });
      }
      // Bundled sample (openable online; offline only once downloaded).
      if (!byId.has(SAMPLE.lessonId)) byId.set(SAMPLE.lessonId, SAMPLE);
      // Gateway-published lessons (online only).
      if (navigator.onLine) {
        for (const l of await listLessons()) {
          if (!byId.has(l.lessonId)) byId.set(l.lessonId, { lessonId: l.lessonId, topic: l.topic, course: l.course, university: l.university, offline: false });
        }
      }
      if (!cancelled) setRows([...byId.values()]);
    })();
    return () => { cancelled = true; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="alwe-lessons-card">
      <h2>✨ Adaptive Whiteboard Lessons</h2>
      <p className="lib-sub">Interactive, voice-guided lessons that adapt to you — and work offline once downloaded.</p>
      <div className="alwe-lessons-list">
        {rows.map((r) => (
          <div key={r.lessonId} className="alwe-lesson-row">
            <span className="alwe-lesson-meta">
              <strong>{r.topic}</strong>
              <em>{r.university} {r.course}</em>
            </span>
            <span className="alwe-lesson-actions">
              {r.offline && <span className="badge-offline">offline</span>}
              <button className="alwe-lesson-open" onClick={() => openLesson(r.lessonId)}>Open</button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
