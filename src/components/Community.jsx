// EFIKO — Community section (V2 R5). Study groups with a member-only discussion feed.
// Two views in one section: a list (discover + my groups + create) and a group detail (feed).
import { useEffect, useState, useRef } from 'react';
import { listGroups, myGroups, createGroup, getGroup, joinGroup, leaveGroup, postMessage, deletePost } from '../community.js';

const timeAgo = (ms) => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Community({ signedIn, user, onSignIn }) {
  const [groups, setGroups] = useState([]);
  const [mineIds, setMineIds] = useState(new Set());
  const [active, setActive] = useState(null);      // group id or null
  const [detail, setDetail] = useState(null);       // { group, member, members, posts }
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const feedEnd = useRef(null);

  async function loadList() {
    const [all, mine] = await Promise.all([listGroups(), signedIn ? myGroups() : Promise.resolve([])]);
    setGroups(all); setMineIds(new Set(mine.map((g) => g.id))); setLoaded(true);
  }
  useEffect(() => { loadList(); }, [signedIn]);

  async function openGroup(id) {
    setActive(id); setDetail(null); setErr(null);
    setDetail(await getGroup(id));
  }
  useEffect(() => { if (detail?.posts?.length) feedEnd.current?.scrollIntoView({ block: 'nearest' }); }, [detail?.posts?.length]);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!signedIn) return onSignIn();
    setBusy(true); setErr(null);
    try {
      const g = await createGroup({ name: name.trim(), topic: topic.trim() });
      setName(''); setTopic('');
      await loadList();
      openGroup(g.id);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function join() {
    if (!signedIn) return onSignIn();
    setBusy(true); setErr(null);
    try { await joinGroup(active); await openGroup(active); await loadList(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function leave() {
    setBusy(true);
    try { await leaveGroup(active); await openGroup(active); await loadList(); } finally { setBusy(false); }
  }

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const post = await postMessage(active, text.trim());
      setText('');
      setDetail((d) => ({ ...d, posts: [...d.posts, post] }));
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  async function removePost(postId) {
    setDetail((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== postId) }));
    await deletePost(active, postId);
  }

  // ---- Group detail view ----
  if (active) {
    const g = detail?.group;
    return (
      <section className="community">
        <button className="back" onClick={() => { setActive(null); setDetail(null); loadList(); }}>← All groups</button>
        {!detail ? <p className="lib-sub">Loading…</p> : (
          <>
            <div className="grp-detail-head">
              <div>
                <h2>👥 {g.name}</h2>
                {g.topic && <p className="lib-sub">{g.topic}</p>}
                <p className="grp-meta">{g.memberCount} member{g.memberCount !== 1 ? 's' : ''} · started by {g.ownerName}</p>
              </div>
              {detail.member
                ? <button className="opp-save" onClick={leave} disabled={busy}>Leave</button>
                : <button className="course-open" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join group'}</button>}
            </div>
            {err && <p className="error">{err}</p>}

            {detail.member ? (
              <>
                <div className="grp-feed">
                  {detail.posts.length === 0 && <p className="grp-empty">No messages yet — start the conversation.</p>}
                  {detail.posts.map((p) => {
                    const canDelete = p.userId === user?.userId || g.ownerId === user?.userId;
                    return (
                      <div key={p.id} className={`grp-msg ${p.userId === user?.userId ? 'mine' : ''}`}>
                        <div className="grp-msg-head"><strong>{p.name}</strong><span>{timeAgo(p.createdAt)}</span>
                          {canDelete && <button className="grp-del" onClick={() => removePost(p.id)} aria-label="Delete message">×</button>}
                        </div>
                        <p className="grp-msg-text">{p.text}</p>
                      </div>
                    );
                  })}
                  <div ref={feedEnd} />
                </div>
                <form className="grp-post" onSubmit={send}>
                  <input className="ask-input" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} />
                  <button className="course-open" type="submit" disabled={busy || !text.trim()}>Send</button>
                </form>
              </>
            ) : (
              <p className="grp-empty">Join this group to see and join the discussion.</p>
            )}
          </>
        )}
      </section>
    );
  }

  // ---- Group list view ----
  const mine = groups.filter((g) => mineIds.has(g.id));
  const others = groups.filter((g) => !mineIds.has(g.id));
  const Card = (g) => (
    <button key={g.id} className="grp-card" onClick={() => openGroup(g.id)}>
      <span className="grp-card-name">👥 {g.name}</span>
      {g.topic && <span className="grp-card-topic">{g.topic}</span>}
      <span className="grp-card-meta">{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</span>
    </button>
  );

  return (
    <section className="community">
      <h2>👥 Community</h2>
      <p className="lib-sub">Learn together — join a study group or start your own and discuss with peers.</p>

      <form className="grp-create" onSubmit={create}>
        <input className="ask-input" placeholder="New group name, e.g. Organic Chemistry Crew" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <input className="ask-input" placeholder="What's it about? (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy} />
        <button className="course-open" type="submit" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create group'}</button>
      </form>
      {err && <p className="error">{err}</p>}

      {signedIn && mine.length > 0 && (<>
        <h3 className="grp-h">My groups</h3>
        <div className="grp-grid">{mine.map(Card)}</div>
      </>)}

      <h3 className="grp-h">Discover</h3>
      {loaded && others.length === 0 && <p className="grp-empty">{mine.length ? 'You’ve joined every group so far!' : 'No groups yet — create the first one above.'}</p>}
      <div className="grp-grid">{others.map(Card)}</div>
    </section>
  );
}
