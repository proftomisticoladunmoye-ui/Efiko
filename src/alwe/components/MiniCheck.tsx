// EFIKO ALWE — one inline knowledge-check question (used by pause-point gates and the
// per-scene knowledge check). Scores immediately and reports the result up so the
// adaptive layer (Batch 7) can react to wrong concepts.
import { useState, type ReactElement } from 'react';
import type { KnowledgeCheck } from '../types';

interface Props {
  check: KnowledgeCheck;
  onResult?: (correct: boolean, wrongConceptTags: string[]) => void;
}

export default function MiniCheck({ check, onResult }: Props): ReactElement {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  function choose(j: number): void {
    if (answered) return;
    setPicked(j);
    const correct = j === check.answer;
    onResult?.(correct, correct ? [] : (check.conceptTags || []));
  }

  return (
    <div className="alwe-minicheck">
      <p className="alwe-q-text">{check.q}</p>
      <div className="alwe-q-options">
        {check.options.map((opt, j) => {
          const cls = ['alwe-opt'];
          if (answered && j === check.answer) cls.push('correct');
          else if (answered && j === picked) cls.push('wrong');
          return (
            <button key={j} className={cls.join(' ')} disabled={answered} onClick={() => choose(j)}>{opt}</button>
          );
        })}
      </div>
      {answered && (
        <p className={`alwe-score ${picked === check.answer ? 'all' : ''}`}>
          {picked === check.answer ? '✓ Correct.' : '✗ Not quite — the highlighted option is right.'}
        </p>
      )}
    </div>
  );
}
