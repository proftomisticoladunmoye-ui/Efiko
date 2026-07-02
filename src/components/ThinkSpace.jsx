// EFIKO — ThinkSpace panel (V2 R2). A right-dock Academic Intelligence Workspace: persistent
// discussions, each with memory. Desktop docks right; mobile slides over.
import { useEffect, useRef, useState } from 'react';
import { listDiscussions, createDiscussion, getDiscussion, ask, generate } from '../thinkspace.js';

function ResourceCard({ r }) {
  const [open, setOpen] = useState(false);
  const title = r.type === 'summary' ? '📌 Summary' : r.type === 'quiz' ? '✅ Quiz' : '🃏 Flashcards';
  return (
    <div className="ts-res">
      <button className="ts-res-head" onClick={() => setOpen((o) => !o)}>{open ? '▾' : '▸'} {title}</button>
      {open && (
        <div className="ts-res-body">
          {r.type === 'summary' && <p>{r.data.text}</p>}
          {r.type === 'flashcards' && <ul>{(r.data.items || []).map((f, i) => <li key={i}><strong>{f.front}</strong> — {f.back}</li>)}</ul>}
          {r.type === 'quiz' && (r.data.items || []).map((q, i) => (
            <div key={i} className="ts-res-q">
              <p><strong>{i + 1}. {q.q}</strong></p>
              <ul>{(q.options || []).map((o, j) => <li key={j} className={j === q.answer ? 'ts-correct' : ''}>{o}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThinkSpace({ open, onClose, user, onNeedAuth }) {
  const [discussions, setDiscussions] = useState([]);
  const [active, setActive] = useState(null); // { id, title, messages: [] }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(null);
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
      setActive({ id: d.id, title: d.title, messages: [], resources: [] });
    } catch (e) { setErr(e.message); }
  }

  async function openDiscussion(id) {
    const d = await getDiscussion(id);
    if (d) setActive({ id: d.id, title: d.title, messages: d.messages, resources: d.resources || [] });
  }

  async function runTool(tool) {
    if (!active || genBusy) return;
    setGenBusy(tool); setErr(null);
    try {
      const resource = await generate(active.id, tool);
      setActive((a) => ({ ...a, resources: [...(a.resources || []), resource] }));
    } catch (e) { setErr(e.message); } finally { setGenBusy(null); }
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
              {(active.resources || []).length > 0 && (
                <div className="ts-resources">
                  <span className="ts-res-h">Resources</span>
                  {active.resources.map((r) => <ResourceCard key={r.id} r={r} />)}
                </div>
              )}
            </div>
            {err && <p className="error" style={{ padding: '0 14px' }}>{err}</p>}
            <div className="ts-tools">
              <button disabled={!!genBusy} onClick={() => runTool('summary')}>{genBusy === 'summary' ? '…' : '📌 Summary'}</button>
              <button disabled={!!genBusy} onClick={() => runTool('quiz')}>{genBusy === 'quiz' ? '…' : '✅ Quiz'}</button>
              <button disabled={!!genBusy} onClick={() => runTool('flashcards')}>{genBusy === 'flashcards' ? '…' : '🃏 Flashcards'}</button>
            </div>
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
