// Efiko — renders a LearningResponse. An adapter (here, the PWA) only renders the
// blocks its channel supports; it never contains teaching logic (Stage 1, §3.1).
import { useState, useEffect, useRef } from 'react';
import { getAudio, recordMastery } from '../storage/capsuleStore.js';
import { reportProgress } from '../progress.js';

function TextBlock({ block }) {
  return <p className="capsule-text">{block.value}</p>;
}

// Progressively "draw" the SVG: stroke lines/paths on, then fade in fills + labels.
// This gives the whiteboard-animation feel WITHOUT shipping a video (data-budget safe).
function drawOn(svg) {
  const vb = (svg.getAttribute('viewBox') || '0 0 1 1').split(/\s+/).map(Number);
  const area = (vb[2] || 1) * (vb[3] || 1);
  let delay = 0;

  const strokes = [...svg.querySelectorAll('path, line, polyline, polygon')];
  const fills = [...svg.querySelectorAll('rect, circle, ellipse, text')];

  fills.forEach((el) => {
    const w = parseFloat(el.getAttribute('width')) || 0;
    const h = parseFloat(el.getAttribute('height')) || 0;
    // Leave a full-canvas background rect visible from the start.
    if (el.tagName.toLowerCase() === 'rect' && w * h >= area * 0.8) return;
    el.style.opacity = '0';
    el.dataset.fade = '1';
  });
  strokes.forEach((el) => {
    const stroke = el.getAttribute('stroke');
    if (!stroke || stroke === 'none') return;
    let len = 0;
    try { len = el.getTotalLength(); } catch { len = 0; }
    if (!len) return;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    el.dataset.draw = '1';
    el.dataset.delay = String(delay);
    delay += 0.3;
  });
  fills.forEach((el) => {
    if (el.dataset.fade) { el.dataset.delay = String(delay); delay += 0.12; }
  });

  requestAnimationFrame(() => {
    svg.querySelectorAll('[data-draw]').forEach((el) => {
      el.style.transition = `stroke-dashoffset 0.7s ease ${el.dataset.delay}s`;
      el.style.strokeDashoffset = '0';
    });
    svg.querySelectorAll('[data-fade]').forEach((el) => {
      el.style.transition = `opacity 0.45s ease ${el.dataset.delay}s`;
      el.style.opacity = '1';
    });
  });
}

function WhiteboardBlock({ block }) {
  const ref = useRef(null);
  const [markup, setMarkup] = useState(block.inlineSvg || null);

  // AI capsules carry inline SVG; catalog capsules carry a precached .svg URL — fetch
  // and inline it so we can animate it (an <img> can't be animated internally).
  useEffect(() => {
    if (block.inlineSvg) { setMarkup(block.inlineSvg); return; }
    if (!block.src) return;
    let cancelled = false;
    fetch(block.src)
      .then((r) => (r.ok ? r.text() : null))
      .then((txt) => { if (!cancelled && txt && txt.includes('<svg')) setMarkup(txt); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [block.src, block.inlineSvg]);

  useEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (svg) drawOn(svg);
  }, [markup]);

  if (!markup) {
    return (
      <figure className="whiteboard">
        {block.src && <img src={block.src} alt={block.caption || 'whiteboard'} />}
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className="whiteboard">
      <div className="whiteboard-stage" ref={ref} dangerouslySetInnerHTML={{ __html: markup }} />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

function VoiceBlock({ block, capsule }) {
  const capsuleId = capsule?.capsuleId;
  const [src, setSrc] = useState(block.src || block.ref || null);
  const [cached, setCached] = useState(false);

  // Prefer voice bytes saved by Campus Sync — plays with zero network (Stage 11).
  useEffect(() => {
    let url;
    let cancelled = false;
    (async () => {
      const rec = capsuleId && (await getAudio(capsuleId));
      if (!cancelled && rec?.blob) {
        url = URL.createObjectURL(rec.blob);
        setSrc(url);
        setCached(true);
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [capsuleId]);

  if (src) {
    return (
      <div className="voice">
        <audio controls preload="none" src={src} />
        {cached && <span className="voice-offline">✓ saved for offline</span>}
      </div>
    );
  }
  return (
    <div className="voice voice--pending">
      🔊 Voice note — <em>{block.pending || 'coming soon'}</em>
    </div>
  );
}

function QuizBlock({ block, capsule }) {
  const [picked, setPicked] = useState({});
  const recorded = useRef(false);
  const items = block.items;
  const answered = Object.keys(picked).length;
  const allDone = answered === items.length;
  const score = items.reduce((s, it, i) => s + (picked[i] === it.answer ? 1 : 0), 0);
  const pct = Math.round((score / items.length) * 100);

  // Record the result once per attempt → feeds the Exam Mode Readiness Score.
  useEffect(() => {
    if (allDone && !recorded.current && capsule) {
      recorded.current = true;
      recordMastery(capsule, score, items.length).catch(() => {});
      // Also report to the server (progress + certificates) when signed in.
      reportProgress({ university: capsule.meta?.university, course: capsule.meta?.course, event: 'quiz', score, total: items.length });
    }
  }, [allDone, capsule, score, items.length]);

  const retry = () => { setPicked({}); recorded.current = false; };

  return (
    <div className="quiz">
      {items.map((item, i) => (
        <div key={i} className="quiz-item">
          <p className="quiz-q">{i + 1}. {item.q}</p>
          <div className="quiz-options">
            {item.options.map((opt, o) => {
              const chosen = picked[i];
              const isChosen = chosen === o;
              const reveal = chosen !== undefined;
              const correct = o === item.answer;
              const cls = !reveal ? '' : correct ? 'correct' : isChosen ? 'wrong' : '';
              return (
                <button
                  key={o}
                  className={`quiz-opt ${cls}`}
                  disabled={reveal}
                  onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {allDone && (
        <div className="quiz-result">
          <span>You scored <strong>{score}/{items.length}</strong> ({pct}%) {pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'}</span>
          <button className="quiz-retry" onClick={retry}>Try again</button>
        </div>
      )}
    </div>
  );
}

function FlashcardsBlock({ block }) {
  const [flipped, setFlipped] = useState({});
  return (
    <div className="flashcards">
      {block.items.map((card, i) => (
        <button
          key={i}
          className={`flashcard ${flipped[i] ? 'is-flipped' : ''}`}
          onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
        >
          {flipped[i] ? card.back : card.front}
        </button>
      ))}
    </div>
  );
}

function SummaryBlock({ block }) {
  return (
    <div className="summary">
      <strong>Summary</strong>
      <p>{block.value}</p>
    </div>
  );
}

const RENDERERS = {
  text: TextBlock,
  whiteboard: WhiteboardBlock,
  voice: VoiceBlock,
  quiz: QuizBlock,
  flashcards: FlashcardsBlock,
  summary: SummaryBlock
};

const SECTION_TITLES = {
  whiteboard: 'Whiteboard',
  voice: 'Voice lesson',
  quiz: 'Practice quiz',
  flashcards: 'Flashcards'
};

export default function CapsuleView({ capsule }) {
  const { meta } = capsule;
  // Mark the course started for signed-in learners (no-op for visitors).
  useEffect(() => {
    reportProgress({ university: meta?.university, course: meta?.course, event: 'opened' });
  }, [capsule.capsuleId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <article className="capsule">
      <header className="capsule-header">
        <span className="badge">{meta.university} · {meta.course}</span>
        <h1>{meta.topic}</h1>
        <p className="capsule-sub">
          Capsule {meta.sequence} · {meta.durationMin} min · {capsule.totalSizeKB} KB
        </p>
      </header>

      {capsule.blocks.map((block, i) => {
        const Renderer = RENDERERS[block.type];
        if (!Renderer) return null;
        const title = SECTION_TITLES[block.type];
        return (
          <section key={i} className={`block block--${block.type}`}>
            {title && <h2 className="block-title">{title}</h2>}
            <Renderer block={block} capsule={capsule} />
          </section>
        );
      })}
    </article>
  );
}
