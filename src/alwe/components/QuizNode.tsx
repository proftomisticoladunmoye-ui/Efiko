// EFIKO ALWE — a quiz node (mini-quiz / final quiz). Scores a list of KnowledgeChecks,
// reports per-concept results to analytics, and on wrong answers surfaces "Explain my
// mistake" with a scene-scoped replay (adaptive replay). See ARCHITECTURE §9.
import { useState, type ReactElement } from 'react';
import type { KnowledgeCheck, LessonPackage } from '../types';
import { explainMistakes } from '../engine/adaptiveReplay';
import ExplainMistake from './ExplainMistake';

export interface QuizResult {
  results: { conceptTags: string[]; correct: boolean }[];
  wrongConceptTags: string[];
  correct: number;
  total: number;
}

interface Props {
  title: string;
  quiz: KnowledgeCheck[];
  pkg: LessonPackage;
  onComplete?: (r: QuizResult) => void;
  onReplayScene: (sceneId: string) => void;
}

export default function QuizNode({ title, quiz, pkg, onComplete, onReplayScene }: Props): ReactElement {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredAll = quiz.every((_, i) => picked[i] !== undefined);
  const correct = quiz.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);
  const wrongConceptTags = submitted
    ? quiz.flatMap((q, i) => (picked[i] !== q.answer ? (q.conceptTags || []) : []))
    : [];

  function submit(): void {
    setSubmitted(true);
    onComplete?.({
      results: quiz.map((q, i) => ({ conceptTags: q.conceptTags || [], correct: picked[i] === q.answer })),
      wrongConceptTags: quiz.flatMap((q, i) => (picked[i] !== q.answer ? (q.conceptTags || []) : [])),
      correct,
      total: quiz.length
    });
  }

  return (
    <div className="alwe-quiz">
      <h3 className="alwe-card-title">📝 {title}</h3>
      {quiz.map((q, i) => (
        <div className="alwe-q" key={i}>
          <p className="alwe-q-text">{i + 1}. {q.q}</p>
          <div className="alwe-q-options">
            {q.options.map((opt, j) => {
              const chosen = picked[i] === j;
              const cls = ['alwe-opt'];
              if (submitted && j === q.answer) cls.push('correct');
              else if (submitted && chosen && j !== q.answer) cls.push('wrong');
              else if (chosen) cls.push('chosen');
              return (
                <button key={j} className={cls.join(' ')} disabled={submitted}
                  onClick={() => setPicked((prev) => ({ ...prev, [i]: j }))}>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!submitted ? (
        <button className="alwe-submit" disabled={!answeredAll} onClick={submit}>Check answers</button>
      ) : (
        <>
          <p className={`alwe-score ${correct === quiz.length ? 'all' : ''}`}>
            You scored {correct} / {quiz.length}. {correct === quiz.length ? 'Excellent!' : 'See where to revisit below, then continue.'}
          </p>
          <ExplainMistake items={explainMistakes(pkg, wrongConceptTags)} onReplayScene={onReplayScene} />
        </>
      )}
    </div>
  );
}
