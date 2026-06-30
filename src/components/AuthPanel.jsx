// EFIKO — sign up / sign in panel (V1.5). Email + password; toggles between modes.
import { useState } from 'react';
import { signup, login } from '../auth.js';

export default function AuthPanel({ onAuthed, onClose }) {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const user = mode === 'signup' ? await signup(name, email, password) : await login(email, password);
      onAuthed(user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email && password && (mode === 'login' || name);

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sign in">
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <h2>{mode === 'signup' ? 'Create your EFIKO account' : 'Welcome back'}</h2>
        <p className="auth-sub">{mode === 'signup' ? 'Save your progress and unlock your EFIKO AI tutor.' : 'Sign in to continue learning.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <input className="ask-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          )}
          <input className="ask-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input className="ask-input" type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <button className="auth-btn" type="submit" disabled={busy || !canSubmit}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Sign in'}
          </button>
          {err && <p className="error">{err}</p>}
        </form>
        <p className="auth-toggle">
          {mode === 'signup' ? 'Already have an account?' : 'New to EFIKO?'}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setErr(null); }}>
            {mode === 'signup' ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
