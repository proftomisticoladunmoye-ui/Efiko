// EFIKO ALWE — SVG object renderers. One component per object type; each takes the
// object plus its current render state (from TimelineEngine) and returns SVG. Stroke
// draw-on uses the `pathLength="1"` trick so we never need getTotalLength or refs.
// Batch 2 ships the 4 core types (text/label, line/arrow, coordinatePlane, equation);
// other types render a labelled placeholder until their batch.
import type { ReactElement } from 'react';
import type { AlweObject, ObjectType } from '../types';
import type { ObjectRenderState } from '../engine/TimelineEngine';

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export interface ObjectProps {
  obj: AlweObject;
  state: ObjectRenderState;
}

// Stroke-draw attributes derived from drawProgress (normalised path length).
function drawAttrs(state: ObjectRenderState) {
  return {
    pathLength: 1,
    strokeDasharray: 1,
    strokeDashoffset: 1 - state.drawProgress
  } as const;
}

function TextObject({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  return (
    <text
      x={num(p.x)} y={num(p.y)}
      className="alwe-text"
      fontSize={num(p.fontSize, 16)}
      style={{ opacity: state.opacity }}
    >
      {str(p.text, obj.explainText)}
    </text>
  );
}

function LabelObject({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  return (
    <g style={{ opacity: state.opacity }} className={state.highlight ? 'alwe-hl' : undefined}>
      <text x={num(p.x)} y={num(p.y)} className="alwe-label" fontSize={num(p.fontSize, 14)}>
        {str(p.text, obj.explainText)}
      </text>
    </g>
  );
}

function LineObject({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  const x1 = num(p.x1, num(p.x));
  const y1 = num(p.y1, num(p.y));
  const x2 = num(p.x2, num(p.toX));
  const y2 = num(p.y2, num(p.toY));
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} className="alwe-stroke" {...drawAttrs(state)} style={{ opacity: state.visible ? 1 : 0 }} />
  );
}

function ArrowObject({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  const x1 = num(p.x1, num(p.x));
  const y1 = num(p.y1, num(p.y));
  const x2 = num(p.x2, num(p.toX));
  const y2 = num(p.y2, num(p.toY));
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = 8;
  const hx = x2 - head * Math.cos(ang - Math.PI / 6);
  const hy = y2 - head * Math.sin(ang - Math.PI / 6);
  const hx2 = x2 - head * Math.cos(ang + Math.PI / 6);
  const hy2 = y2 - head * Math.sin(ang + Math.PI / 6);
  return (
    <g style={{ opacity: state.visible ? 1 : 0 }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="alwe-stroke" {...drawAttrs(state)} />
      <polyline points={`${hx},${hy} ${x2},${y2} ${hx2},${hy2}`} className="alwe-stroke" style={{ opacity: state.drawProgress > 0.95 ? 1 : 0 }} fill="none" />
    </g>
  );
}

function CoordinatePlane({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  const x = num(p.x, 40), y = num(p.y, 20), w = num(p.w, 400), h = num(p.h, 240);
  const ox = x, oy = y + h; // origin (bottom-left)
  const da = drawAttrs(state);
  return (
    <g style={{ opacity: state.visible ? 1 : 0 }}>
      {/* x-axis */}
      <line x1={ox} y1={oy} x2={x + w} y2={oy} className="alwe-axis" {...da} />
      {/* y-axis */}
      <line x1={ox} y1={oy} x2={ox} y2={y} className="alwe-axis" {...da} />
      {/* origin tick + 0.5 gridline on y, appear once axes are mostly drawn */}
      <line x1={ox} y1={y + h / 2} x2={x + w} y2={y + h / 2} className="alwe-grid" style={{ opacity: state.drawProgress > 0.9 ? 1 : 0 }} />
    </g>
  );
}

// Minimal, dependency-free readability pass for the few LaTeX tokens our lessons use.
function latexToText(s: string): string {
  return s
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\theta/g, 'θ')
    .replace(/\^\{([^}]*)\}/g, '^($1)')
    .replace(/[{}]/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\/g, '');
}

function EquationObject({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  const raw = str(p.text) || str(p.latex);
  return (
    <text x={num(p.x, 40)} y={num(p.y, 60)} className="alwe-equation" fontSize={num(p.fontSize, 22)} style={{ opacity: state.opacity }}>
      {p.text ? raw : latexToText(raw)}
    </text>
  );
}

// Graceful placeholder for object types not yet implemented (graph, pointer, highlight,
// table, chart, …). Keeps any lesson loadable; these get real renderers in later batches.
function Placeholder({ obj, state }: ObjectProps): ReactElement {
  const p = obj.props;
  const x = num(p.x, 60), y = num(p.y, 60), w = num(p.w, 160), h = num(p.h, 60);
  const label = str(p.label, obj.explainText || obj.type);
  return (
    <g style={{ opacity: state.opacity }} className={state.highlight ? 'alwe-hl' : undefined}>
      <rect x={x} y={y} width={w} height={h} rx={8} className="alwe-placeholder" />
      <text x={x + 8} y={y + h / 2 + 4} className="alwe-placeholder-text" fontSize={12}>{label}</text>
    </g>
  );
}

const REGISTRY: Partial<Record<ObjectType, (props: ObjectProps) => ReactElement>> = {
  text: TextObject,
  label: LabelObject,
  line: LineObject,
  arrow: ArrowObject,
  coordinatePlane: CoordinatePlane,
  equation: EquationObject
};

export function renderObject(obj: AlweObject, state: ObjectRenderState): ReactElement {
  const Comp = REGISTRY[obj.type] ?? Placeholder;
  return <Comp obj={obj} state={state} />;
}
