// EFIKO ALWE — smart pause point. The timeline halts and asks the learner something
// ("Why is the X-axis drawn first?"); they reflect or answer a gate, then choose to
// continue. The clock only resumes on their action. See ARCHITECTURE §"Smart Pause Points".
import { useState, type ReactElement } from 'react';
import type { PausePoint } from '../types';
import MiniCheck from './MiniCheck';

interface Props {
  pause: PausePoint;
  onContinue: () => void;
}

export default function PausePrompt({ pause, onContinue }: Props): ReactElement {
  const [answered, setAnswered] = useState(!pause.answer); // no gate → ready immediately

  return (
    <div className="alwe-pausept" role="dialog" aria-label="Pause point">
      <span className="alwe-pausept-kicker">⏸ Pause &amp; think</span>
      <p className="alwe-pausept-prompt">{pause.prompt}</p>
      {pause.answer && <MiniCheck check={pause.answer} onResult={() => setAnswered(true)} />}
      <button className="alwe-next" disabled={!answered} onClick={onContinue}>Continue ▶</button>
    </div>
  );
}
