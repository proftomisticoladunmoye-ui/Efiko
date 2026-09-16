// EFIKO — auto-suggest Efiko Lite when a Full-mode user hits a slow or costly connection.
// Smart mode already adapts on its own, so this only nudges people who explicitly chose Full.
// Dismissal is remembered so we never nag.
import { useState } from 'react';
import { usePerfMode, setMode } from '../perfMode.js';

const KEY = 'efiko-lite-suggested';

export default function LiteSuggest() {
  const { mode, constrained } = usePerfMode();
  const [dismissed, setDismissed] = useState(() => { try { return !!localStorage.getItem(KEY); } catch { return false; } });

  if (dismissed || !constrained || mode !== 'full') return null;

  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setDismissed(true); };

  return (
    <div className="lite-suggest" role="status">
      <span>📶 Slow or costly connection. Switch to <strong>Efiko Lite</strong> to use less data?</span>
      <div className="lite-suggest-actions">
        <button className="lite-suggest-yes" onClick={() => { setMode('lite'); close(); }}>Use Lite</button>
        <button className="lite-suggest-no" onClick={close}>Not now</button>
      </div>
    </div>
  );
}
