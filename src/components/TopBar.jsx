// EFIKO 2.0 — top bar (R1: App Shell). Brand, the always-present "Ask Efiko AI" input,
// online status, and the account menu. Credits meter arrives in R3.
import { useState } from 'react';

export default function TopBar({ logo, name, institution, user, online, asking, onAsk, onSignIn, onSignOut, onMenu }) {
  const [q, setQ] = useState('');
  function submit(e) {
    e.preventDefault();
    const t = q.trim();
    if (t) { onAsk(t); setQ(''); }
  }
  return (
    <header className="topbar">
      <button className="topbar-menu" onClick={onMenu} aria-label="Menu">☰</button>
      <img className="topbar-logo" src={logo || '/logo.png'} alt={name || 'Efiko'} />
      <form className="topbar-ask" onSubmit={submit} role="search">
        <span className="topbar-ask-icon" aria-hidden="true">✦</span>
        <input className="topbar-ask-input" placeholder="Ask Efiko AI — learn anything" value={q} onChange={(e) => setQ(e.target.value)} disabled={asking} aria-label="Ask Efiko AI" />
        <button className="topbar-ask-btn" type="submit" disabled={asking || !q.trim()}>{asking ? '…' : 'Ask'}</button>
      </form>
      <div className="topbar-account">
        <span className={`topbar-dot ${online ? 'up' : 'down'}`} title={online ? 'Online' : 'Offline'} aria-hidden="true" />
        {institution && <span className="topbar-inst">{institution}</span>}
        {user ? (
          <span className="account-chip">
            <span className="account-name">{user.name}</span>
            <button className="account-btn" onClick={onSignOut}>Sign out</button>
          </span>
        ) : (
          <button className="account-btn" onClick={onSignIn}>Sign in</button>
        )}
      </div>
    </header>
  );
}
