// EFIKO ALWE — lesson outline / jump-to-scene drawer. Lists every arc node with a
// completion tick and highlights the current one. Tapping a node jumps to it.
import type { ReactElement } from 'react';
import { LessonController } from '../engine/LessonController';

interface Props {
  ctrl: LessonController;
  currentIndex: number;
  onJump: (index: number) => void;
}

export default function LessonOutline({ ctrl, currentIndex, onJump }: Props): ReactElement {
  return (
    <nav className="alwe-outline" aria-label="Lesson outline">
      <ol>
        {ctrl.arc.map((node, i) => {
          const scene = ctrl.sceneOf(node);
          const label = LessonController.labelFor(node, scene?.title);
          const done = scene ? ctrl.isCompleted(scene.id) : i < currentIndex;
          const cls = ['alwe-outline-item'];
          if (i === currentIndex) cls.push('current');
          if (done) cls.push('done');
          return (
            <li key={i}>
              <button className={cls.join(' ')} onClick={() => onJump(i)} aria-current={i === currentIndex}>
                <span className="alwe-outline-mark">{done ? '✓' : i === currentIndex ? '▶' : i + 1}</span>
                <span className="alwe-outline-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
