// EFIKO ALWE — Explain Again. Surfaces the scene's pre-generated explanation variants as
// tappable chips. All offline (bundled at publish), so it works with zero network. The
// adaptive layer (Batch 7/8) can also open this sheet to a specific variant on demand.
import { useState, type ReactElement } from 'react';
import type { ExplainBundle } from '../types';

type Key = keyof ExplainBundle;
const VARIANTS: [Key, string][] = [
  ['simpler', '🟢 Simpler'],
  ['practicalExample', '🧩 Example'],
  ['africanContext', '🌍 African example'],
  ['visualAnalogy', '🔗 Analogy'],
  ['realLifeScenario', '🏞️ Real life'],
  ['commonMistakes', '⚠️ Common mistakes'],
  ['memoryTip', '🧠 Memory tip'],
  ['detailed', '📖 More detail']
];

export default function ExplainAgainSheet({ explain, initialKey }: { explain: ExplainBundle; initialKey?: Key }): ReactElement {
  const [open, setOpen] = useState<boolean>(!!initialKey);
  const [key, setKey] = useState<Key | null>(initialKey ?? null);

  return (
    <div className="alwe-explain">
      <button className="alwe-explain-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        🔁 Explain again
      </button>
      {open && (
        <>
          <div className="alwe-explain-chips" role="tablist">
            {VARIANTS.map(([k, label]) => (
              <button key={k} className={`alwe-chip ${key === k ? 'on' : ''}`} role="tab" aria-selected={key === k} onClick={() => setKey(k)}>
                {label}
              </button>
            ))}
          </div>
          {key && <p className="alwe-explain-text">{explain[key]}</p>}
        </>
      )}
    </div>
  );
}
