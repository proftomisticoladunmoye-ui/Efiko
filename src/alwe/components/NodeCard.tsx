// EFIKO ALWE — renders a structural lesson node (intro, reflection, summary) as a
// readable card. Scene and quiz nodes have their own components.
import type { ReactElement } from 'react';
import type { LessonNode } from '../types';

const ICON: Record<string, string> = { intro: '🚀', reflection: '🧠', summary: '📌' };
const KICKER: Record<string, string> = { intro: 'Introduction', reflection: 'Pause & reflect', summary: 'Summary' };

export default function NodeCard({ node }: { node: LessonNode }): ReactElement {
  return (
    <div className="alwe-card">
      <span className="alwe-card-kicker">{ICON[node.kind] || '•'} {KICKER[node.kind] || ''}</span>
      {node.title && <h3 className="alwe-card-title">{node.title}</h3>}
      {node.body && <p className="alwe-card-body">{node.body}</p>}
    </div>
  );
}
