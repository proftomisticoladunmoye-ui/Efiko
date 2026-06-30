// EFIKO ALWE — Teach Back offline evaluation. A transparent keyword-recall check of the
// learner's explanation against the rubric's expected points. Works with no network; the
// online path (net/teachBack) adds nuanced Claude feedback when connected. See §21.

const STOP = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'for', 'are', 'was', 'its', 'into', 'than', 'then', 'when', 'where', 'which', 'have', 'has', 'you', 'your', 'how', 'why']);

function keywords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
}

export interface TeachBackResult {
  coverage: number;   // 0..1 fraction of expected points recalled
  hit: string[];
  missed: string[];
}

/** A point counts as recalled if ≥40% of its keywords appear in the learner's explanation. */
export function evaluateTeachBack(explanation: string, expectedPoints: string[]): TeachBackResult {
  const said = new Set(keywords(explanation));
  const hit: string[] = [];
  const missed: string[] = [];
  for (const point of expectedPoints) {
    const keys = keywords(point);
    const overlap = keys.filter((k) => said.has(k)).length;
    if (keys.length > 0 && overlap / keys.length >= 0.4) hit.push(point);
    else missed.push(point);
  }
  return { coverage: expectedPoints.length ? hit.length / expectedPoints.length : 0, hit, missed };
}
