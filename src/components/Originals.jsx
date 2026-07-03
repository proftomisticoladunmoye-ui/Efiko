// EFIKO Originals — learner course player (Phase 2). Browse the published EFIKO Originals
// library, then take a course through its standard architecture: overview -> pre-assessment
// -> sessions (each with whiteboard, example, quiz, flashcards, reflection, summary) ->
// final assessment -> completion (+ recommended next course). Self-contained section.
import { useEffect, useRef, useState } from 'react';
import { listOriginals, getOriginal, claimOriginalCertificate, synthesizeVoice, evaluateTeachBack } from '../originals.js';
import { reportProgress } from '../progress.js';
import CertificateCard from './CertificateCard.jsx';

// --- a small reusable multiple-choice quiz ---
function MiniQuiz({ questions, onDone, cta = 'Submit answers' }) {
  const [picked, setPicked] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const total = questions.length;
  const answered = Object.keys(picked).length;
  const score = questions.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);
  const pct = total ? Math.round((score / total) * 100) : 0;

  function submit() {
    if (answered < total) return;
    setSubmitted(true);
    onDone?.({ score, total, pct });
  }
  return (
    <div className="oq">
      {questions.map((q, i) => (
        <div key={i} className="oq-item">
          <p className="oq-q">{i + 1}. {q.q}</p>
          <div className="oq-opts">
            {q.options.map((opt, oi) => {
              const chosen = picked[i] === oi;
              const state = submitted ? (oi === q.answer ? 'correct' : (chosen ? 'wrong' : '')) : (chosen ? 'chosen' : '');
              return (
                <button key={oi} className={`oq-opt ${state}`} disabled={submitted} onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}>{opt}</button>
              );
            })}
          </div>
        </div>
      ))}
      {!submitted
        ? <button className="course-open" disabled={answered < total} onClick={submit}>{answered < total ? `Answer all ${total} questions` : cta}</button>
        : <p className="oq-score">You scored {score}/{total} ({pct}%)</p>}
    </div>
  );
}

function SessionView({ session, index, count, onNext, onAsk, nextLabel }) {
  const [quizDone, setQuizDone] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [voice, setVoice] = useState('idle'); // idle | loading | playing | error
  const [voiceErr, setVoiceErr] = useState(null);
  const audioRef = useRef(null);

  function stopAudio() { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }
  useEffect(() => { setQuizDone(false); setShowCards(false); setVoice('idle'); setVoiceErr(null); stopAudio(); return stopAudio; }, [session.id]);

  async function listen() {
    if (voice === 'playing') { stopAudio(); setVoice('idle'); return; }
    setVoice('loading'); setVoiceErr(null);
    try {
      const url = await synthesizeVoice(session.voiceScript || session.text);
      const a = new Audio(url); audioRef.current = a;
      a.onended = () => setVoice('idle');
      await a.play(); setVoice('playing');
    } catch (e) { setVoice('error'); setVoiceErr(e.message); }
  }

  return (
    <div className="osession">
      <p className="o-step">Session {index + 1} of {count}</p>
      <h2>{session.title}</h2>
      {session.objectives?.length > 0 && (
        <ul className="o-objectives">{session.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
      )}
      <button className={`o-listen ${voice}`} onClick={listen} disabled={voice === 'loading'}>
        {voice === 'loading' ? '… loading voice' : voice === 'playing' ? '⏸ Pause voice lesson' : '🔊 Listen to this session'}
      </button>
      {voiceErr && <p className="o-voice-note">Voice isn’t available right now.</p>}
      {session.whiteboardSvg && (
        <figure key={session.id} className="o-board animate" dangerouslySetInnerHTML={{ __html: session.whiteboardSvg }} />
      )}
      {session.whiteboardCaption && <p className="o-caption">{session.whiteboardCaption}</p>}
      {session.keyPoints?.length > 0 && (
        <ul className="o-keypoints">{session.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
      )}
      <div className="o-prose">{session.text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
      {session.example && <div className="o-example"><strong>Example.</strong> {session.example}</div>}

      <h3>Check your understanding</h3>
      <MiniQuiz questions={session.quiz} cta="Check answers" onDone={() => setQuizDone(true)} />

      <div className="o-extras">
        <button className="course-share-btn" onClick={() => setShowCards((s) => !s)}>{showCards ? 'Hide' : 'Show'} flashcards ({session.flashcards.length})</button>
        {showCards && <div className="o-cards">{session.flashcards.map((c, i) => <div key={i} className="o-card"><strong>{c.front}</strong><span>{c.back}</span></div>)}</div>}
      </div>

      {session.reflection && <div className="o-reflect"><strong>Reflect.</strong> {session.reflection}</div>}
      {session.summary && <div className="o-summary"><strong>Summary.</strong> {session.summary}</div>}
      {session.discussionPrompt && (
        <button className="o-discuss" onClick={() => onAsk?.(session.discussionPrompt)}>💬 Discuss with EFIKO AI: “{session.discussionPrompt}”</button>
      )}

      <div className="o-nav">
        <button className="course-open" disabled={!quizDone} onClick={onNext}>{quizDone ? nextLabel : 'Check the quiz to continue'}</button>
      </div>
    </div>
  );
}

// Teach Back checkpoint: the learner explains the covered sessions in their own words and
// EFIKO evaluates before letting them proceed.
function TeachBack({ course, from, to, onPass }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const covered = course.sessions.slice(from, to + 1);

  async function submit() {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    try { setResult(await evaluateTeachBack(course.courseId, from, to, text.trim())); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="osession teachback">
      <p className="o-step">Teach-back checkpoint</p>
      <h2>🎓 Teach it back</h2>
      <p className="lib-sub">Explain what you just learned in your own words — teaching it back is one of the most effective ways to lock in learning. EFIKO will check your understanding before you move on.</p>
      <p className="tb-cover">Covers: {covered.map((s) => s.title).join('  ·  ')}</p>
      <textarea className="tb-input" rows={6} placeholder="In your own words, explain the key ideas from these sessions, as if teaching a friend…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
      {result && (
        <div className={`tb-result ${result.understood ? 'ok' : 'retry'}`}>
          <p className="tb-verdict">{result.understood ? '✓ Well explained — you’ve got it' : '↻ Not quite yet — refine your explanation'}{typeof result.score === 'number' ? `  (${result.score}%)` : ''}</p>
          <p>{result.feedback}</p>
          {result.missing?.length > 0 && <ul className="tb-missing">{result.missing.map((m, i) => <li key={i}>{m}</li>)}</ul>}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="o-nav">
        {result?.understood
          ? <button className="course-open" onClick={onPass}>Continue →</button>
          : <button className="course-open" disabled={busy || !text.trim()} onClick={submit}>{busy ? 'EFIKO is checking…' : (result ? 'Revise & resubmit' : 'Submit for feedback')}</button>}
      </div>
    </div>
  );
}

function CoursePlayer({ course, onExit, onAsk, signedIn, onSignIn }) {
  const [step, setStep] = useState('overview'); // 'overview' | 'pre' | number | 'tb:from:to' | 'final' | 'done'
  const [finalPct, setFinalPct] = useState(0);
  const [cpStart, setCpStart] = useState(0); // first session not yet teach-back'd
  const [cert, setCert] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [certErr, setCertErr] = useState(null);
  const sessions = course.sessions || [];
  const passMark = course.finalAssessment?.passMark ?? 70;
  const checkpointDue = (i) => (i - cpStart + 1) >= 2 || i === sessions.length - 1;

  async function claim() {
    if (!signedIn) return onSignIn?.();
    setClaiming(true); setCertErr(null);
    try { setCert(await claimOriginalCertificate(course.courseId)); }
    catch (e) { setCertErr(e.message); } finally { setClaiming(false); }
  }

  useEffect(() => { reportProgress({ courseId: course.courseId, event: 'opened' }); }, [course.courseId]);

  const stepIndex = step === 'overview' || step === 'pre' ? 0
    : step === 'done' ? sessions.length + 1
      : step === 'final' ? sessions.length
        : typeof step === 'number' ? step
          : (typeof step === 'string' && step.startsWith('tb:') ? Number(step.split(':')[2]) + 1 : 0);
  const progressPct = Math.round((stepIndex / (sessions.length + 1)) * 100);

  return (
    <section className="originals">
      <button className="back" onClick={onExit}>← All Originals</button>
      <div className="o-progress"><span style={{ width: `${progressPct}%` }} /></div>

      {step === 'overview' && (
        <div className="o-overview">
          <span className="o-badge">⭐ EFIKO Original</span>
          <h1>{course.title}</h1>
          {course.subtitle && <p className="o-subtitle">{course.subtitle}</p>}
          <p className="o-meta">{[course.category, course.level, course.estimatedHours && `${course.estimatedHours} hours`, `${sessions.length} sessions`].filter(Boolean).join(' · ')}</p>
          {course.description && <p className="o-desc">{course.description}</p>}
          {course.outcomes?.length > 0 && (<><h3>What you'll learn</h3><ul className="o-outcomes">{course.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul></>)}
          <h3>Course sessions</h3>
          <ol className="o-sesslist">{sessions.map((s) => <li key={s.id}>{s.title}</li>)}</ol>
          <div className="o-start">
            {course.preAssessment?.questions?.length > 0 && <button className="course-share-btn" onClick={() => setStep('pre')}>Take the pre-assessment first</button>}
            <button className="course-open" onClick={() => setStep(0)}>Start course →</button>
          </div>
        </div>
      )}

      {step === 'pre' && (
        <div className="osession">
          <h2>Pre-assessment</h2>
          <p className="lib-sub">A quick check of what you already know — it doesn't count towards your certificate.</p>
          <MiniQuiz questions={course.preAssessment.questions} cta="See how you did" onDone={() => {}} />
          <div className="o-nav"><button className="course-open" onClick={() => setStep(0)}>Start the course →</button></div>
        </div>
      )}

      {typeof step === 'number' && (
        <SessionView key={sessions[step].id} session={sessions[step]} index={step} count={sessions.length}
          onAsk={onAsk}
          nextLabel={checkpointDue(step) ? '🎓 Teach-back →' : (step + 1 < sessions.length ? 'Next session →' : 'Final assessment →')}
          onNext={() => { setStep(checkpointDue(step) ? `tb:${cpStart}:${step}` : step + 1); window.scrollTo(0, 0); }} />
      )}

      {typeof step === 'string' && step.startsWith('tb:') && (() => {
        const [, from, to] = step.split(':').map(Number);
        return (
          <TeachBack key={step} course={course} from={from} to={to}
            onPass={() => { const next = to + 1; setCpStart(next); setStep(next < sessions.length ? next : 'final'); window.scrollTo(0, 0); }} />
        );
      })()}

      {step === 'final' && (
        <div className="osession">
          <h2>Final assessment</h2>
          <p className="lib-sub">Pass with {passMark}% or more to complete the course.</p>
          <MiniQuiz questions={course.finalAssessment.questions} cta="Submit final assessment"
            onDone={({ pct, score, total }) => { setFinalPct(pct); reportProgress({ courseId: course.courseId, event: 'quiz', score, total }); }} />
          {finalPct > 0 && (
            <div className="o-nav"><button className="course-open" onClick={() => { setStep('done'); reportProgress({ courseId: course.courseId, event: finalPct >= passMark ? 'completed' : 'quiz' }); window.scrollTo(0, 0); }}>Continue →</button></div>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className="o-done">
          {finalPct >= passMark ? (<>
            <div className="o-done-badge">🎓</div>
            <h1>Course complete!</h1>
            <p className="o-subtitle">You passed <strong>{course.title}</strong> with {finalPct}%.</p>
            {course.competencies?.length > 0 && (<><h3>Competencies gained</h3><ul className="o-outcomes">{course.competencies.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
            <div className="o-nav">
              <button className="course-open" disabled={claiming} onClick={claim}>{claiming ? 'Issuing…' : (signedIn ? '🎓 Claim your certificate' : 'Sign in to claim your certificate')}</button>
            </div>
            {certErr && <p className="error">{certErr}</p>}
          </>) : (<>
            <h1>Almost there</h1>
            <p className="o-subtitle">You scored {finalPct}% — {passMark}% is needed to pass. Review the sessions and try again.</p>
            <button className="course-open" onClick={() => setStep(0)}>Review sessions</button>
          </>)}
          {course.nextCourse && finalPct >= passMark && (
            <div className="o-next"><span>Recommended next</span><strong>{course.nextCourse}</strong></div>
          )}
        </div>
      )}

      {cert && <CertificateCard cert={cert} onClose={() => setCert(null)} />}
    </section>
  );
}

export default function Originals({ onAsk, signedIn, onSignIn }) {
  const [courses, setCourses] = useState([]);
  const [active, setActive] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { listOriginals().then((c) => { setCourses(c); setLoaded(true); }); }, []);
  async function open(id) { const c = await getOriginal(id); if (c) { setActive(c); window.scrollTo(0, 0); } }

  if (active) return <CoursePlayer course={active} onExit={() => setActive(null)} onAsk={onAsk} signedIn={signedIn} onSignIn={onSignIn} />;

  return (
    <section className="originals">
      <h2>⭐ EFIKO Originals</h2>
      <p className="lib-sub">Free, expert-designed micro-certificate courses — built by EFIKO. Learn a skill, earn a certificate.</p>
      {loaded && courses.length === 0 && <p className="career-empty">No published courses yet — check back soon.</p>}
      <div className="o-grid">
        {courses.map((c) => (
          <button key={c.courseId} className="o-course-card" onClick={() => open(c.courseId)}>
            <span className="o-badge">⭐ Original</span>
            <span className="o-card-title">{c.title}</span>
            {c.subtitle && <span className="o-card-sub">{c.subtitle}</span>}
            <span className="o-card-meta">{[c.category, c.level].filter(Boolean).join(' · ')}</span>
            <span className="o-card-foot">{[c.estimatedHours && `${c.estimatedHours}h`, `${c.sessionCount} sessions`].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
