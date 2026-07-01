// EFIKO — public certificate verification (V2). Anyone with a serial (or the verify link)
// can confirm a certificate's authenticity. No account needed.
import { useEffect, useState } from 'react';
import { verifyCertificate } from '../certificates.js';

const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');

export default function VerifyCertificate({ serial, onExit }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => { verifyCertificate(serial).then((r) => setState({ loading: false, ...r })); }, [serial]);

  return (
    <div className="app">
      <div className="verify-page">
        <img src="/logo.png" alt="Efiko" width="150" />
        <h2>Certificate verification</h2>
        {state.loading ? (
          <p className="alwe-loading">Checking…</p>
        ) : state.valid ? (
          <div className="verify-ok">
            <p className="verify-badge">✓ Authentic</p>
            <p><strong>{state.name}</strong> completed</p>
            <h3>{state.courseTitle}</h3>
            {state.score != null && <p>Score: {state.score}%</p>}
            <p className="lib-sub">Issued {fmt(state.issuedAt)} · Serial {state.serial}</p>
          </div>
        ) : (
          <div className="verify-bad">
            <p className="verify-badge bad">✗ Not found</p>
            <p className="lib-sub">No certificate matches serial “{serial}”.</p>
          </div>
        )}
        <button className="back" onClick={onExit}>← Go to Efiko</button>
      </div>
    </div>
  );
}
