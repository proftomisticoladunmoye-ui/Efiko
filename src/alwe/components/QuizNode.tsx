// EFIKO ALWE — a quiz node (mini-quiz / final quiz). Scores a list of KnowledgeChecks.
// Reports the result up so the lesson can drive analytics + adaptive replay (Batch 7);
// for now it just scores and lets the learner continue.
import { useState, type ReactElement } from 'react';
import type { KnowledgeCheck } from '../types';

interface Props {
  title: string;
  quiz: KnowledgeCheck[];
  onScored?: (result: { correct: number; total: number; wrongConceptTags: string[] }) => void;
}

export default function QuizNode({ title, quiz, onScored }: Props): ReactElement {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredAll = quiz.every((_, i) => picked[i] !== undefined);
  const correct = quiz.reduce((n, q, i) => n + (picked[i] === q.answer ? 1 : 0), 0);

  function submit() {
    setSubmitted(true);
    const wrongConceptTags = quiz.flatMap((q, i) => (picked[i] !== q.answer ? (q.conceptTags || []) : []));
    onScored?.({ correct, total: quiz.length, wrongConceptTags });
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
        <p className={`alwe-score ${correct === quiz.length ? 'all' : ''}`}>
          You scored {correct} / {quiz.length}. {correct === quiz.length ? 'Excellent!' : 'Review the highlighted answers, then continue.'}
        </p>
      )}
    </div>
  );
}
