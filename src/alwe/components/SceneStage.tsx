// EFIKO ALWE — the drawing surface. Renders a scene's objects as SVG, applying the
// per-object render state from the TimelineEngine each frame. Interactive objects are
// tappable (full tap-to-explain behaviour arrives in Batch 5).
import type { ReactElement } from 'react';
import type { Scene, AlweObject, LearningMode } from '../types';
import type { ObjectRenderState } from '../engine/TimelineEngine';
import { renderObject } from '../objects/renderers';
import { objectInMode } from '../modes/learningModes';

interface Props {
  scene: Scene;
  states: Map<string, ObjectRenderState>;
  onObjectTap?: (obj: AlweObject) => void;
  focusedId?: string | null;
  mode?: LearningMode;
}

const HIDDEN: ObjectRenderState = { visible: false, drawProgress: 0, opacity: 0, highlight: false };

export default function SceneStage({ scene, states, onObjectTap, focusedId, mode = 'normal' }: Props): ReactElement {
  return (
    <svg className="alwe-stage" viewBox="0 0 540 330" role="img" aria-label={scene.title} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={540} height={330} className="alwe-board" />
      {scene.objects.map((obj) => {
        if (!objectInMode(obj, mode)) return null;
        const state = states.get(obj.id) ?? HIDDEN;
        if (!state.visible) return null;
        const tappable = obj.interactive && onObjectTap;
        const cls = ['alwe-obj'];
        if (tappable) cls.push('alwe-tappable');
        if (focusedId) cls.push(obj.id === focusedId ? 'alwe-focused' : 'alwe-dimmed');
        return (
          <g
            key={obj.id}
            className={cls.join(' ')}
            onClick={tappable ? () => onObjectTap!(obj) : undefined}
            onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onObjectTap!(obj); } } : undefined}
            role={tappable ? 'button' : undefined}
            tabIndex={tappable ? 0 : undefined}
            aria-label={tappable ? (obj.explainText || obj.type) : undefined}
          >
            {renderObject(obj, state)}
          </g>
        );
      })}
    </svg>
  );
}
