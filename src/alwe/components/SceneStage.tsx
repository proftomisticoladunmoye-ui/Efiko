// EFIKO ALWE — the drawing surface. Renders a scene's objects as SVG, applying the
// per-object render state from the TimelineEngine each frame. Interactive objects are
// tappable (full tap-to-explain behaviour arrives in Batch 5).
import type { ReactElement } from 'react';
import type { Scene, AlweObject } from '../types';
import type { ObjectRenderState } from '../engine/TimelineEngine';
import { renderObject } from '../objects/renderers';

interface Props {
  scene: Scene;
  states: Map<string, ObjectRenderState>;
  onObjectTap?: (obj: AlweObject) => void;
}

const HIDDEN: ObjectRenderState = { visible: false, drawProgress: 0, opacity: 0, highlight: false };

export default function SceneStage({ scene, states, onObjectTap }: Props): ReactElement {
  return (
    <svg className="alwe-stage" viewBox="0 0 540 330" role="img" aria-label={scene.title} preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={540} height={330} className="alwe-board" />
      {scene.objects.map((obj) => {
        const state = states.get(obj.id) ?? HIDDEN;
        if (!state.visible) return null;
        const tappable = obj.interactive && onObjectTap;
        return (
          <g
            key={obj.id}
            className={tappable ? 'alwe-obj alwe-tappable' : 'alwe-obj'}
            onClick={tappable ? () => onObjectTap!(obj) : undefined}
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
