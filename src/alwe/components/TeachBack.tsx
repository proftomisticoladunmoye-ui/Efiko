// EFIKO ALWE — Teach Back Mode (protégé effect). The learner explains the concept in
// their own words; an offline recall check runs immediately, and when online Claude adds
// nuanced feedback. Explaining-to-learn is among the best-evidenced retention boosters.
import { useState, type ReactElement } from 'react';
import type { TeachBackRubric } from '../types';
import { evaluateTeachBack, type TeachBackResult } from '../engine/teachBack';
import { gradeTeachBack } from '../net/teachBack';

interface Props {
  rubric: TeachBackRubric;
  topic: string;
  sceneTitle: string;
  objective: string;
  onAttempt?: () => void;
}

export default function TeachBack({ rubric, topic, sceneTitle, objective, onAttempt }: Props): ReactElement {
  const [text, setText] = useState('');
  const [result, setResult] = useState<TeachBackResult | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!text.trim()) return;
    onAttempt?.();
    setResult(evaluateTeachBack(text, rubric.expectedPoints)); // offline, instant
    if (navigator.onLine) {
      setLoading(true); setErr(null);
      try {
        setFeedback(await gradeTeachBack({ topic, sceneTitle, objective, expectedPoints: rubric.expectedPoints, explanation: text }));
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
  }

  const pct = result ? Math.round(result.coverage * 100) : 0;

  return (
    <div className="alwe-teachback">
      <span className="alwe-kc-h">🗣️ Teach it back</span>
      <p className="alwe-tb-prompt">{rubric.prompt}</p>
      <textarea
        className="alwe-tb-input" rows={4} value={text} placeholder="Explain it in your own words…"
        onChange={(e) => setText(e.target.value)} disabled={!!result}
      />
      {!result ? (
        <button className="alwe-submit" disabled={!text.trim()} onClick={submit}>Submit explanation</button>
      ) : (
        <div className="alwe-tb-result">
          <div className="alwe-tb-coverage">
            <div className="alwe-tb-bar"><span style={{ width: `${pct}%` }} /></div>
            <span>{pct}% of key points covered</span>
          </div>
          {result.hit.length > 0 && (
            <ul className="alwe-tb-hit">{result.hit.map((p, i) => <li key={i}>✓ {p}</li>)}</ul>
          )}
          {result.missed.length > 0 && (
            <ul className="alwe-tb-missed">{result.missed.map((p, i) => <li key={i}>◦ Also mention: {p}</li>)}</ul>
          )}
          {loading && <p className="alwe-coach-msg">Getting feedback…</p>}
          {feedback && <p className="alwe-explain-text">💬 {feedback}</p>}
          {err && <p className="alwe-pack-err">{err}</p>}
        </div>
      )}
    </div>
  );
}
