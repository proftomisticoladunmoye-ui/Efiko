// EFIKO ALWE — runtime validation for a LessonPackage. Zero-dependency; mirrors the
// TypeScript contract in src/alwe/types.ts. Used by the packager and the smoke test to
// guarantee a published lesson is well-formed and within the offline size budget.
// See docs/ALWE-ARCHITECTURE.md §15.

const OBJECT_TYPES = new Set([
  'text', 'arrow', 'circle', 'rectangle', 'triangle', 'line', 'graph', 'table', 'chart',
  'equation', 'coordinatePlane', 'timeline', 'flowchart', 'icon', 'label', 'highlight',
  'underline', 'pointer'
]);
const ANIM_KINDS = new Set(['appear', 'draw', 'highlight', 'fade', 'move', 'dim']);
const MODES = new Set(['fast', 'normal', 'deep']);
const DIFFICULTY = new Set(['intro', 'core', 'stretch']);
const STRUCTURAL = new Set(['intro', 'scene', 'miniQuiz', 'reflection', 'summary', 'finalQuiz']);
const EXPLAIN_KEYS = [
  'simpler', 'detailed', 'practicalExample', 'africanContext',
  'realLifeScenario', 'visualAnalogy', 'commonMistakes', 'memoryTip'
];

// Offline budget (see §13). Hard fail above MAX; warn above TARGET.
export const SIZE_TARGET_BYTES = 2 * 1024 * 1024;
export const SIZE_MAX_BYTES = 3 * 1024 * 1024;

const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isArr = Array.isArray;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function validateKnowledgeCheck(kc, path, errors) {
  if (!isObj(kc)) return errors.push(`${path}: must be an object`);
  if (!isStr(kc.q)) errors.push(`${path}.q: required string`);
  if (!isArr(kc.options) || kc.options.length < 2) errors.push(`${path}.options: need ≥2 options`);
  if (!isNum(kc.answer) || kc.answer < 0 || (isArr(kc.options) && kc.answer >= kc.options.length)) {
    errors.push(`${path}.answer: must index into options`);
  }
}

function validateObject(o, path, errors) {
  if (!isObj(o)) return errors.push(`${path}: must be an object`);
  if (!isStr(o.id)) errors.push(`${path}.id: required string`);
  if (!OBJECT_TYPES.has(o.type)) errors.push(`${path}.type: invalid "${o.type}"`);
  if (!isObj(o.props)) errors.push(`${path}.props: required object`);
  const a = o.animation;
  if (!isObj(a)) errors.push(`${path}.animation: required object`);
  else {
    if (!ANIM_KINDS.has(a.kind)) errors.push(`${path}.animation.kind: invalid "${a.kind}"`);
    if (!isNum(a.startMs) || a.startMs < 0) errors.push(`${path}.animation.startMs: required ≥0`);
    if (!isNum(a.durationMs) || a.durationMs < 0) errors.push(`${path}.animation.durationMs: required ≥0`);
  }
  if (o.modes && (!isArr(o.modes) || o.modes.some((m) => !MODES.has(m)))) {
    errors.push(`${path}.modes: invalid mode`);
  }
}

function validateExplain(e, path, errors) {
  if (!isObj(e)) return errors.push(`${path}: required object`);
  for (const k of EXPLAIN_KEYS) if (!isStr(e[k])) errors.push(`${path}.${k}: required string`);
}

function validateScene(s, path, errors, segmentIds) {
  if (!isObj(s)) return errors.push(`${path}: must be an object`);
  if (!isStr(s.id)) errors.push(`${path}.id: required string`);
  if (!isStr(s.title)) errors.push(`${path}.title: required string`);
  if (!isStr(s.objective)) errors.push(`${path}.objective: required string`);
  if (!isNum(s.estimatedMs)) errors.push(`${path}.estimatedMs: required number`);
  if (!DIFFICULTY.has(s.difficulty)) errors.push(`${path}.difficulty: invalid "${s.difficulty}"`);

  if (!isArr(s.objects) || s.objects.length === 0) errors.push(`${path}.objects: need ≥1`);
  else s.objects.forEach((o, i) => validateObject(o, `${path}.objects[${i}]`, errors));

  if (!isArr(s.segments)) errors.push(`${path}.segments: required array`);
  else s.segments.forEach((seg, i) => {
    const p = `${path}.segments[${i}]`;
    if (!isStr(seg.id)) errors.push(`${p}.id: required string`); else segmentIds.add(seg.id);
    if (seg.sceneId !== s.id) errors.push(`${p}.sceneId: must equal "${s.id}"`);
    if (!isNum(seg.startMs) || !isNum(seg.endMs) || seg.endMs < seg.startMs) errors.push(`${p}: bad start/end`);
    if (!isStr(seg.text)) errors.push(`${p}.text: required string`);
    if (!(seg.clipId === null || isStr(seg.clipId))) errors.push(`${p}.clipId: string or null`);
  });

  if (!isArr(s.pausePoints)) errors.push(`${path}.pausePoints: required array`);
  else s.pausePoints.forEach((pp, i) => {
    const p = `${path}.pausePoints[${i}]`;
    if (!isNum(pp.atMs)) errors.push(`${p}.atMs: required number`);
    if (!isStr(pp.prompt)) errors.push(`${p}.prompt: required string`);
    if (pp.answer) validateKnowledgeCheck(pp.answer, `${p}.answer`, errors);
  });

  if (s.knowledgeCheck) validateKnowledgeCheck(s.knowledgeCheck, `${path}.knowledgeCheck`, errors);
  validateExplain(s.explain, `${path}.explain`, errors);

  // Objects referencing a voice segment must point at a real one in this scene.
  s.objects?.forEach((o, i) => {
    if (o.voiceSegmentId && !segmentIds.has(o.voiceSegmentId)) {
      errors.push(`${path}.objects[${i}].voiceSegmentId: unknown segment "${o.voiceSegmentId}"`);
    }
  });
}

/**
 * Validate a LessonPackage. Returns { ok, errors, warnings, bytes }.
 * `bytes` is the JSON size; clip bytes are added by the packager when voicing.
 */
export function validateLessonPackage(pkg) {
  const errors = [];
  const warnings = [];
  if (!isObj(pkg)) return { ok: false, errors: ['package: must be an object'], warnings, bytes: 0 };

  const m = pkg.manifest;
  if (!isObj(m)) errors.push('manifest: required object');
  else {
    if (!isStr(m.lessonId)) errors.push('manifest.lessonId: required string');
    if (m.format !== 'alwe') errors.push('manifest.format: must be "alwe"');
    if (!isNum(m.version)) errors.push('manifest.version: required number');
    if (!isObj(m.meta) || !isStr(m.meta.university) || !isStr(m.meta.course) || !isStr(m.meta.topic)) {
      errors.push('manifest.meta: needs university, course, topic');
    }
    if (!MODES.has(m.defaultMode)) errors.push('manifest.defaultMode: invalid');
    if (!isArr(m.arc) || m.arc.length === 0) errors.push('manifest.arc: need ≥1 node');
  }

  const scenes = pkg.scenes;
  const sceneIds = new Set();
  const segmentIds = new Set();
  if (!isArr(scenes) || scenes.length === 0) errors.push('scenes: need ≥1');
  else scenes.forEach((s, i) => {
    validateScene(s, `scenes[${i}]`, errors, segmentIds);
    if (isStr(s?.id)) sceneIds.add(s.id);
  });

  // Every arc node of kind 'scene' must resolve to a real scene; quizzes must carry items.
  if (isObj(m) && isArr(m.arc)) m.arc.forEach((n, i) => {
    const p = `manifest.arc[${i}]`;
    if (!STRUCTURAL.has(n.kind)) errors.push(`${p}.kind: invalid "${n.kind}"`);
    if (n.kind === 'scene') {
      if (!isStr(n.sceneId)) errors.push(`${p}.sceneId: required for scene node`);
      else if (!sceneIds.has(n.sceneId)) errors.push(`${p}.sceneId: unknown scene "${n.sceneId}"`);
    }
    if ((n.kind === 'miniQuiz' || n.kind === 'finalQuiz')) {
      if (!isArr(n.quiz) || n.quiz.length === 0) errors.push(`${p}.quiz: need ≥1 question`);
      else n.quiz.forEach((q, j) => validateKnowledgeCheck(q, `${p}.quiz[${j}]`, errors));
    }
  });

  const bytes = Buffer.byteLength(JSON.stringify(pkg), 'utf8');
  if (bytes > SIZE_MAX_BYTES) errors.push(`size: package JSON ${(bytes / 1048576).toFixed(2)}MB exceeds 3MB max`);
  else if (bytes > SIZE_TARGET_BYTES) warnings.push(`size: package JSON over 2MB target (${(bytes / 1048576).toFixed(2)}MB)`);

  return { ok: errors.length === 0, errors, warnings, bytes };
}
