// EFIKO ALWE — "Explain my mistake": after a wrong answer, show the misconception note
// for the scene that taught the concept, plus a one-tap scene-scoped replay. Offline.
import type { ReactElement } from 'react';
import type { MistakeItem } from '../engine/adaptiveReplay';

interface Props {
  items: MistakeItem[];
  onReplayScene: (sceneId: string) => void;
}

export default function ExplainMistake({ items, onReplayScene }: Props): ReactElement | null {
  if (!items.length) return null;
  return (
    <div className="alwe-mistake">
      <span className="alwe-mistake-h">🔍 Explain my mistake</span>
      {items.map((it) => (
        <div className="alwe-mistake-item" key={it.sceneId}>
          <p className="alwe-mistake-where">On <strong>{it.sceneTitle}</strong>:</p>
          <p className="alwe-mistake-text">{it.commonMistakes}</p>
          <button className="alwe-replay-btn" onClick={() => onReplayScene(it.sceneId)}>↺ Replay this scene</button>
        </div>
      ))}
    </div>
  );
}
