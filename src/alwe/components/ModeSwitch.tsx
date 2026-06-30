// EFIKO ALWE — Learning mode selector (Fast / Normal / Deep). Switches pacing live,
// no re-download. See modes/learningModes.ts.
import type { ReactElement } from 'react';
import type { LearningMode } from '../types';
import { MODES } from '../modes/learningModes';

export default function ModeSwitch({ mode, onChange }: { mode: LearningMode; onChange: (m: LearningMode) => void }): ReactElement {
  return (
    <div className="alwe-modes" role="radiogroup" aria-label="Learning mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`alwe-mode ${mode === m.id ? 'on' : ''}`}
          role="radio" aria-checked={mode === m.id}
          title={m.hint} onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
