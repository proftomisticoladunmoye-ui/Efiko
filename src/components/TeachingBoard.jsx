// EFIKO — AI Teaching Whiteboard player (R9). Walks the learner through a generated teaching
// sequence: SEE the board build up, HEAR the narration (spoken by the device — no audio to
// download), INTERACT by advancing and answering the odd check, then TEACH BACK in your own
// words. Honours the performance mode: Lite skips auto-narration and the draw-in animation.
import { useEffect, useRef, useState } from 'react';
import { usePerfMode } from '../perfMode.js';
import { reportProgress } from '../progress.js';
import { evaluateTeachBack } from '../teachback.js';

const VERDICT = {
  mastered:   { label: 'Mastered',   emoji: '🏆', cls: 'mastered' },
  almost:     { label: 'Almost there', emoji: '🌱', cls: 'almost' },
  developing: { label: 'Developing', emoji: '🧭', cls: 'developing' }
};

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export default function TeachingBoard({ sequence, onExit, topic }) {
  const { effective } = usePerfMode();
  const lite = effective === 'lite';
  const steps = sequence?.steps || [];

  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState(null); // selected option index for the current check
  const [phase, setPhase] = useState('steps');     // 'steps' | 'teachback' | 'done'
  const [muted, setMuted] = useState(lite);         // Lite is quiet by default (still tap-to-hear)
  const [tb, setTb] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null); // AI assessment of the teach-back
  const reportedRef = useRef(false);
  const boardTopic = sequence.topic || topic || 'this concept';

  const step = steps[i];
  const last = i === steps.length - 1;

  function speak(text) {
    if (!canSpeak || muted || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; u.pitch = 1; u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch { /* voices unavailable */ }
  }
  const stopSpeaking = () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };

  // Narrate on step change (unless muted). Cleanup stops speech when leaving.
  useEffect(() => {
    if (phase === 'steps' && step) speak(step.say);
    return stopSpeaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase, muted]);
  useEffect(() => stopSpeaking, []);

  // Record one 'opened' event when the board first plays (offline-durable via the outbox).
  useEffect(() => {
    if (!reportedRef.current) { reportedRef.current = true; reportProgress({ university: 'Efiko', course: boardTopic, event: 'opened' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!steps.length) {
    return <div className="tb"><button className="back" onClick={onExit}>← Back</button><p className="lib-sub">This board has no steps.</p></div>;
  }

  function next() {
    if (step.check && answered === null) return; // must answer the check first
    stopSpeaking();
    setAnswered(null);
    if (!last) setI(i + 1);
    else setPhase('teachback');
  }
  function prev() { stopSpeaking(); setAnswered(null); if (i > 0) setI(i - 1); }

  // Submit the teach-back: assess it when online (the payload is tiny), then record mastery.
  // Offline or on failure, we still honour the effort — the explanation is never wasted.
  async function finish() {
    reportProgress({ university: 'Efiko', course: boardTopic, event: 'completed' });
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setEvaluating(true);
      try {
        const evalResult = await evaluateTeachBack(boardTopic, tb.trim());
        setEvaluation(evalResult);
        reportProgress({ university: 'Efiko', course: boardTopic, event: 'teachback', score: evalResult.score });
      } catch { /* fall through to the warm, un-scored done screen */ }
      finally { setEvaluating(false); }
    }
    setPhase('done');
  }

  return (
    <div className="tb">
      <div className="tb-top">
        <button className="back" onClick={() => { stopSpeaking(); onExit(); }}>← Back</button>
        <span className="tb-title">🎨 {sequence.topic || topic}</span>
        {canSpeak && phase === 'steps' && (
          <button className="tb-mute" onClick={() => setMuted((m) => !m)} aria-pressed={!muted} title={muted ? 'Turn narration on' : 'Mute narration'}>
            {muted ? '🔇' : '🔊'}
          </button>
        )}
      </div>

      {phase === 'steps' && (
        <>
          <div className="tb-progress" aria-hidden="true">
            {steps.map((_, n) => <span key={n} className={`tb-dot${n === i ? ' on' : n < i ? ' done' : ''}`} />)}
          </div>

          <div className={`tb-board${lite ? '' : ' draw-in'}`} key={i} dangerouslySetInnerHTML={{ __html: step.svg }} />

          <div className="tb-say">
            <span className="tb-step-title">{step.title}</span>
            <p>{step.say}</p>
            {canSpeak && !muted && <button className="tb-replay" onClick={() => speak(step.say)}>🔊 Hear again</button>}
          </div>

          {step.check && (
            <div className="tb-check">
              <p className="tb-check-q">{step.check.q}</p>
              <div className="tb-check-opts">
                {step.check.options.map((o, n) => {
                  const state = answered === null ? '' : n === step.check.answer ? ' correct' : n === answered ? ' wrong' : '';
                  return (
                    <button key={n} className={`tb-opt${state}`} disabled={answered !== null} onClick={() => setAnswered(n)}>{o}</button>
                  );
                })}
              </div>
              {answered !== null && (
                <p className="tb-check-fb">{answered === step.check.answer ? '✓ Exactly.' : `Not quite — the answer is “${step.check.options[step.check.answer]}”.`}</p>
              )}
            </div>
          )}

          <div className="tb-nav">
            <button className="tb-prev" onClick={prev} disabled={i === 0}>← Previous</button>
            <span className="tb-count">Step {i + 1} of {steps.length}</span>
            <button className="tb-next" onClick={next} disabled={!!step.check && answered === null}>
              {last ? 'Teach it back →' : 'Next →'}
            </button>
          </div>
        </>
      )}

      {phase === 'teachback' && (
        <div className="tb-teachback">
          <span className="tb-step-title">🗣️ Your turn to teach</span>
          <p className="tb-tb-prompt">{sequence.teachBackPrompt}</p>
          <textarea className="tb-tb-input" rows={5} value={tb} onChange={(e) => setTb(e.target.value)} placeholder="Explain it in your own words…" />
          <div className="tb-nav">
            <button className="tb-prev" onClick={() => { setPhase('steps'); setI(steps.length - 1); }} disabled={evaluating}>← Back to board</button>
            <button className="tb-next" onClick={finish} disabled={tb.trim().length < 12 || evaluating}>
              {evaluating ? 'Reading your answer…' : "I've explained it →"}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="tb-done">
          {evaluation ? (() => {
            const v = VERDICT[evaluation.verdict] || VERDICT.almost;
            return (
              <div className="tb-eval">
                <div className={`tb-eval-head ${v.cls}`}>
                  <span className="tb-eval-emoji" aria-hidden="true">{v.emoji}</span>
                  <div>
                    <strong>{v.label}</strong>
                    <span className="tb-eval-score">{evaluation.score}% understanding</span>
                  </div>
                </div>
                <div className="tb-eval-bar" aria-hidden="true"><span style={{ width: `${evaluation.score}%` }} /></div>
                {evaluation.strengths.length > 0 && (
                  <div className="tb-eval-sec">
                    <h4>What you nailed</h4>
                    <ul>{evaluation.strengths.map((s, n) => <li key={n} className="tb-eval-good">✓ {s}</li>)}</ul>
                  </div>
                )}
                {evaluation.gaps.length > 0 && (
                  <div className="tb-eval-sec">
                    <h4>Firm this up next</h4>
                    <ul>{evaluation.gaps.map((s, n) => <li key={n} className="tb-eval-gap">→ {s}</li>)}</ul>
                  </div>
                )}
                <p className="tb-eval-note">{evaluation.encouragement}</p>
                <div className="tb-nav">
                  <button className="tb-prev" onClick={() => { setEvaluation(null); setPhase('teachback'); }}>Try again</button>
                  <button className="tb-next" onClick={onExit}>Learn something else →</button>
                </div>
              </div>
            );
          })() : (
            <>
              <div className="tb-done-badge">🎉</div>
              <h3>Well taught.</h3>
              <p className="lib-sub">Explaining an idea in your own words is how it sticks. You just did the hardest — and most valuable — part of learning.{typeof navigator !== 'undefined' && !navigator.onLine ? ' Reconnect to get Efiko’s feedback on your explanation.' : ''}</p>
              <button className="course-open" onClick={onExit}>Learn something else</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
