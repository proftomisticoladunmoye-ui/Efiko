// EFIKO — ThinkSpace panel (V2 R2). A right-dock Academic Intelligence Workspace: persistent
// discussions, each with memory. Desktop docks right; mobile slides over.
import { useEffect, useRef, useState } from 'react';
import { listDiscussions, createDiscussion, getDiscussion, ask } from '../thinkspace.js';

export default function ThinkSpace({ open, onClose, user, onNeedAuth }) {
  const [discussions, setDiscussions] = useState([]);
  const [active, setActive] = useState(null); // { id, title, messages: [] }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const threadRef = useRef(null);

  useEffect(() => {
    if (open && user) listDiscussions().then(setDiscussions);
  }, [open, user]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [active?.messages?.length, busy]);

  async function newDiscussion() {
    setErr(null);
    try {
      const d = await createDiscussion();
      setDiscussions((list) => [{ id: d.id, title: d.title, updatedAt: d.updatedAt }, ...list]);
      setActive({ id: d.id, title: d.title, messages: [] });
    } catch (e) { setErr(e.message); }
  }

  async function openDiscussion(id) {
    const d = await getDiscussion(id);
    if (d) setActive({ id: d.id, title: d.title, messages: d.messages });
  }

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !active || busy) return;
    setInput(''); setErr(null); setBusy(true);
    setActive((a) => ({ ...a, messages: [...a.messages, { role: 'user', text }] }));
    try {
      const { message, title } = await ask(active.id, text);
      setActive((a) => ({ ...a, title: title || a.title, messages: [...a.messages, { role: 'ai', text: message.text }] }));
      if (title) setDiscussions((list) => list.map((d) => (d.id === active.id ? { ...d, title } : d)));
    } catch (e2) {
      setErr(e2.message);
      setActive((a) => ({ ...a, messages: a.messages.slice(0, -1) })); // roll back the optimistic user msg
      setInput(text);
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <>
      <div className="ts-scrim" onClick={onClose} />
      <aside className="ts-panel" aria-label="ThinkSpace">
        <div className="ts-head">
          <span className="ts-title">🧠 Efiko ThinkSpace</span>
          <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {!user ? (
          <div className="signin-prompt"><p>Sign in to use ThinkSpace — your AI learning workspace.</p><button className="account-btn" onClick={onNeedAuth}>Sign in</button></div>
        ) : active ? (
          <>
            <button className="ts-back" onClick={() => setActive(null)}>‹ Discussions</button>
            <div className="ts-thread" ref={threadRef}>
              {active.messages.length === 0 && <p className="lib-sub">Ask anything — I'll remember this discussion.</p>}
              {active.messages.map((m, i) => (
                <div key={i} className={`ts-msg ${m.role}`}>{m.text}</div>
              ))}
              {busy && <div className="ts-msg ai ts-typing">…</div>}
            </div>
            {err && <p className="error" style={{ padding: '0 14px' }}>{err}</p>}
            <form className="ts-input-row" onSubmit={send}>
              <textarea className="ts-input" rows={2} value={input} placeholder="Ask ThinkSpace…" disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} />
              <button className="ts-send" type="submit" disabled={busy || !input.trim()}>{busy ? '…' : '➤'}</button>
            </form>
          </>
        ) : (
          <>
            <button className="ts-new" onClick={newDiscussion}>+ New Discussion</button>
            <div className="ts-list">
              {discussions.length === 0
                ? <p className="lib-sub" style={{ padding: '0 12px' }}>No discussions yet — start one above.</p>
                : discussions.map((d) => (
                  <button key={d.id} className="ts-disc" onClick={() => openDiscussion(d.id)}>{d.title}</button>
                ))}
            </div>
            {err && <p className="error" style={{ padding: '0 14px' }}>{err}</p>}
          </>
        )}
      </aside>
    </>
  );
}
