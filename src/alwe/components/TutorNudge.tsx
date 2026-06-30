// EFIKO ALWE — Study Coach panel. Shows the Cognitive Tutor's diagnosis as specific,
// actionable nudges: reveal a pre-generated explanation (offline), replay the relevant
// scene, or — when online — ask Claude to explain it another way.
import { useState, type ReactElement } from 'react';
import type { TutorInsight } from '../engine/CognitiveTutor';
import { askCoach } from '../net/coach';

interface Props {
  insights: TutorInsight[];
  topic: string;
  onReplayScene: (sceneId: string) => void;
  onClose: () => void;
  onHelp?: () => void;
}

export default function TutorNudge({ insights, topic, onReplayScene, onClose, onHelp }: Props): ReactElement {
  const [openDetail, setOpenDetail] = useState<number | null>(null);
  const [coach, setCoach] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function askAnother(i: number, ins: TutorInsight): Promise<void> {
    setLoading(i); setErr(null); onHelp?.();
    try {
      const text = await askCoach({ topic, concept: ins.concept, sceneTitle: ins.sceneTitle });
      setCoach((c) => ({ ...c, [i]: text }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="alwe-coach" role="region" aria-label="Study coach">
      <div className="alwe-coach-head">
        <span className="alwe-coach-h">🎓 Study Coach</span>
        <button className="alwe-focus-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      {insights.length === 0 ? (
        <p className="alwe-coach-msg">Answer a check or quiz and I'll tailor guidance to where you're stuck.</p>
      ) : (
        insights.map((ins, i) => (
          <div className="alwe-coach-item" key={i}>
            <p className="alwe-coach-msg">{ins.message}</p>
            {openDetail === i && ins.detail && <p className="alwe-explain-text">{ins.detail}</p>}
            {coach[i] && <p className="alwe-explain-text">💬 {coach[i]}</p>}
            <div className="alwe-coach-actions">
              {ins.detail && (
                <button className="alwe-chip" onClick={() => setOpenDetail(openDetail === i ? null : i)}>
                  {openDetail === i ? 'Hide' : (ins.detailLabel || 'Show explanation')}
                </button>
              )}
              {ins.sceneId && (
                <button className="alwe-replay-btn" onClick={() => onReplayScene(ins.sceneId!)}>↺ Replay this scene</button>
              )}
              {(ins.concept || ins.sceneTitle) && navigator.onLine && (
                <button className="alwe-chip" disabled={loading === i} onClick={() => askAnother(i, ins)}>
                  {loading === i ? 'Thinking…' : '✨ Explain another way'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
      {err && <p className="alwe-pack-err">{err}</p>}
    </div>
  );
}
