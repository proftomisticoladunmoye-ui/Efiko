// EFIKO — visitor landing page (R6). The public front door for efikolearn.online.
// A true marketing page (its own header, no app sidebar) that communicates the
// product principle — "Efiko doesn't just give you answers, it helps you learn" —
// speaks to every segment (students, professionals, creators, institutions), and
// hands visitors into the app in one tap: try the tutor, explore courses, or sign up.
// Deliberately lightweight (inline SVG, no heavy libraries) so it opens fast on a
// weak connection — the same low-bandwidth ethos as Efiko Lite.
import { useEffect, useState } from 'react';
import { fetchPublicStats, niceCount } from '../stats.js';

const SEGMENTS = [
  { id: 'university',   icon: '🎓', title: 'University students', line: 'Ace courses with an AI tutor that explains, quizzes and revises with you.' },
  { id: 'school',       icon: '📚', title: 'Secondary & primary', line: 'Clear, patient lessons that meet each learner at their level.' },
  { id: 'professional', icon: '💼', title: 'Professionals',        line: 'Upskill on your schedule and earn certificates that verify.' },
  { id: 'creator',      icon: '✍️', title: 'Course creators',      line: 'Build visual lessons and sell them to learners across Africa.' },
  { id: 'institution',  icon: '🏫', title: 'Schools & universities', line: 'Run cohorts, track outcomes and brand Efiko as your own.' },
  { id: 'corporate',    icon: '🏢', title: 'Corporate teams',      line: 'Train teams with measurable progress and completion reporting.' }
];

const FEATURES = [
  { icon: '🎙️', title: 'A whiteboard that teaches out loud', line: 'Efiko narrates each step while it draws — like a tutor at the board, not a static slide.' },
  { icon: '🎨', title: 'Illustrates & animates any concept',  line: 'Graphs, diagrams, circuits, biology, physics — drawn and animated to make ideas click.' },
  { icon: '🔁', title: 'Teach-back that checks understanding', line: 'You explain the idea back in your words; Efiko listens and shows you what to firm up.' },
  { icon: '🧠', title: 'An AI tutor that remembers you',       line: 'ThinkSpace keeps the thread of your learning, so every session builds on the last.' },
  { icon: '📶', title: 'Learns with you offline',             line: 'Download courses, lessons and quizzes, keep learning with no data, and sync when you reconnect.' },
  { icon: '🎓', title: 'Certificates that verify',            line: 'Finish a course and earn a certificate anyone can check with a serial number.' }
];

const LOOP = [
  { k: 'See',       icon: '👁️' },
  { k: 'Hear',      icon: '🎧' },
  { k: 'Interact',  icon: '🖐️' },
  { k: 'Practice',  icon: '✍️' },
  { k: 'Teach back', icon: '💬' }
];

export default function Landing({ onGetStarted, onSignIn, onAsk, onExplore, onSelectSegment }) {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { fetchPublicStats().then(setStats); }, []);

  function tryAsk(e) {
    e.preventDefault();
    const topic = q.trim();
    if (topic) onAsk(topic);
    else onExplore('learn');
  }

  return (
    <div className="landing">
      {/* Header */}
      <header className="lp-nav">
        <div className="lp-nav-brand">
          <img src="/logo.png" alt="Efiko" className="lp-logo" />
        </div>
        <nav className="lp-nav-links" aria-label="Landing sections">
          <a href="#lp-features">Features</a>
          <a href="#lp-segments">Who it's for</a>
          <a href="#lp-offline">Offline</a>
        </nav>
        <div className="lp-nav-cta">
          <button className="lp-btn-ghost" onClick={onSignIn}>Sign in</button>
          <button className="lp-btn" onClick={onGetStarted}>Get started</button>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">AI learning that works even offline</span>
          <h1>Efiko doesn't just give you answers.<br /><span className="lp-hl">It helps you learn.</span></h1>
          <p className="lp-lede">
            An AI tutor for African students and professionals — one that talks, teaches, illustrates,
            animates and checks that you truly understand. Built to keep working when the internet doesn't.
          </p>

          <form className="lp-try" onSubmit={tryAsk}>
            <input
              className="lp-try-input"
              placeholder="Ask Efiko anything — e.g. “Explain photosynthesis”"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Ask Efiko a question"
            />
            <button className="lp-btn" type="submit">Try it free</button>
          </form>
          <p className="lp-try-note">No sign-up needed to try. Create a free account to save your progress.</p>

          {stats?.learners >= 5 && (
            <p className="lp-social">
              🎓 <strong>{niceCount(stats.learners)}</strong> learners on Efiko
              {stats.certificates >= 5 ? <> · <strong>{niceCount(stats.certificates)}</strong> certificates earned</> : null}
            </p>
          )}
        </div>
        <div className="lp-hero-art" aria-hidden="true"><WhiteboardArt /></div>
      </section>

      {/* Learning loop */}
      <section className="lp-loop" aria-label="How Efiko teaches">
        <h2 className="lp-loop-h">The way great teachers teach</h2>
        <ol className="lp-loop-row">
          {LOOP.map((s, i) => (
            <li key={s.k} className="lp-loop-step">
              <span className="lp-loop-ico">{s.icon}</span>
              <span className="lp-loop-k">{s.k}</span>
              {i < LOOP.length - 1 && <span className="lp-loop-arrow" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="lp-section" id="lp-features">
        <h2 className="lp-h2">Not a search box. A teacher.</h2>
        <p className="lp-sub">Efiko can talk, teach, illustrate, animate, question, listen, correct and adapt.</p>
        <div className="lp-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="lp-feature">
              <span className="lp-feature-ico">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.line}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Segments */}
      <section className="lp-section" id="lp-segments">
        <h2 className="lp-h2">Built for every kind of learner</h2>
        <p className="lp-sub">From a first-year undergraduate to a whole institution — Efiko meets you where you are.</p>
        <div className="lp-seg-grid">
          {SEGMENTS.map((s) => (
            <button key={s.id} className="lp-seg" onClick={() => onSelectSegment(s.id)}>
              <span className="lp-seg-ico">{s.icon}</span>
              <span className="lp-seg-title">{s.title}</span>
              <span className="lp-seg-line">{s.line}</span>
              <span className="lp-seg-go">Start free →</span>
            </button>
          ))}
        </div>
      </section>

      {/* Offline band */}
      <section className="lp-offline" id="lp-offline">
        <div className="lp-offline-copy">
          <span className="lp-eyebrow">Offline-first, by design</span>
          <h2 className="lp-h2">Learning shouldn't stop when the internet does.</h2>
          <p className="lp-sub">
            Download courses, lessons, quizzes and flashcards while you have a connection.
            Keep learning on the bus, in the village, during a blackout — Efiko remembers everything you did
            and syncs it the moment you're back online.
          </p>
          <div className="lp-offline-pills">
            <span className="lp-pill">📥 Download</span>
            <span className="lp-pill">📵 Learn offline</span>
            <span className="lp-pill">🔄 Sync when you reconnect</span>
          </div>
        </div>
        <div className="lp-sync-card" aria-hidden="true">
          <div className="lp-sync-dot"><span /></div>
          <div className="lp-sync-body">
            <strong>Working offline</strong>
            <span>Last synced 10 minutes ago</span>
            <span className="lp-sync-wait">12 activities waiting to sync</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-cta">
        <h2>Start learning today — free.</h2>
        <p>Works on any phone, on any connection. Create your account in seconds.</p>
        <div className="lp-cta-row">
          <button className="lp-btn lp-btn-lg" onClick={onGetStarted}>Create your free account</button>
          <button className="lp-btn-ghost lp-btn-lg" onClick={() => onExplore('courses')}>Explore courses</button>
        </div>
      </section>
    </div>
  );
}

// Lightweight, on-brand "talking whiteboard" illustration — a board mid-lesson with a
// drawn parabola, a labelled step and a narration bubble. Pure inline SVG, no assets.
function WhiteboardArt() {
  return (
    <svg viewBox="0 0 360 300" className="lp-art-svg" role="img" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lpBoard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f1b30" />
          <stop offset="1" stopColor="#0b1424" />
        </linearGradient>
      </defs>
      {/* board */}
      <rect x="14" y="18" width="332" height="228" rx="14" fill="url(#lpBoard)" stroke="#1e293b" />
      {/* header line */}
      <rect x="34" y="40" width="150" height="12" rx="6" fill="#14b8a6" opacity="0.85" />
      <rect x="34" y="62" width="96" height="8" rx="4" fill="#334155" />
      {/* axes */}
      <line x1="70" y1="210" x2="320" y2="210" stroke="#334155" strokeWidth="2" />
      <line x1="90" y1="96" x2="90" y2="220" stroke="#334155" strokeWidth="2" />
      {/* parabola being drawn */}
      <path d="M96 200 Q170 96 300 168" fill="none" stroke="#2dd4bf" strokeWidth="4" strokeLinecap="round" />
      <circle cx="300" cy="168" r="6" fill="#5eead4" />
      {/* step chip */}
      <rect x="196" y="196" width="118" height="30" rx="8" fill="#0f766e" opacity="0.28" stroke="#14b8a6" />
      <text x="255" y="215" textAnchor="middle" fontFamily="Segoe UI, system-ui, sans-serif" fontSize="13" fill="#5eead4">Step 2 of 4</text>
      {/* narration bubble */}
      <g>
        <rect x="150" y="118" width="150" height="46" rx="12" fill="#111a2e" stroke="#14b8a6" />
        <text x="166" y="140" fontFamily="Segoe UI, system-ui, sans-serif" fontSize="12" fill="#e2e8f0">“Now we complete</text>
        <text x="166" y="156" fontFamily="Segoe UI, system-ui, sans-serif" fontSize="12" fill="#e2e8f0">the square…”</text>
        <circle cx="150" cy="176" r="4" fill="#14b8a6" />
        <circle cx="140" cy="186" r="3" fill="#14b8a6" opacity="0.7" />
      </g>
      {/* speaking indicator */}
      <g transform="translate(300,44)">
        <circle r="14" fill="#14b8a6" opacity="0.18" />
        <rect x="-2" y="-7" width="4" height="14" rx="2" fill="#5eead4" />
        <rect x="-8" y="-4" width="4" height="8" rx="2" fill="#5eead4" />
        <rect x="4" y="-4" width="4" height="8" rx="2" fill="#5eead4" />
      </g>
    </svg>
  );
}
