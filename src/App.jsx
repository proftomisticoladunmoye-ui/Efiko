// Efiko — Stage 3 app shell: offline-first router over the Offline Engine.
// Boot: get the catalog (network → cache fallback), seed one capsule on first run
// so there is offline content, then show "My Courses". Lessons open from IndexedDB.
import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react';
import { fetchCatalog, buildLibrary, syncAll, downloadCapsule, buildPacks, downloadPack, removePack, syncCampus, offlineStatus, publishLesson, fetchPublished } from './sync/syncEngine.js';
import { getCapsule, listCapsules, deleteCapsule, touchViewed, saveCapsule } from './storage/capsuleStore.js';
import CapsuleView from './components/CapsuleView.jsx';
import Library from './components/Library.jsx';
import Packs from './components/Packs.jsx';
import CampusSync from './components/CampusSync.jsx';
import AskEfiko from './components/AskEfiko.jsx';
import SnapLearn from './components/SnapLearn.jsx';
import Studio from './components/Studio.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ExamReadiness from './components/ExamReadiness.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import Certificates from './components/Certificates.jsx';
import VerifyCertificate from './components/VerifyCertificate.jsx';
import Programmes from './components/Programmes.jsx';
import { me as fetchMe, logout as authLogout } from './auth.js';
import { enrolByCode, enrolCourse, fetchEnrolments } from './enrol.js';
import { enrolProgramme } from './programmes.js';
// ALWE engine is lazy-loaded so it never weighs down the student library bundle.
const AlwenPlayer = lazy(() => import('./alwe/components/AlwenPlayer.tsx'));
const AlweStudio = lazy(() => import('./alwe/components/AlweStudio.tsx'));
const Classes = lazy(() => import('./components/Classes.jsx'));
const ProgrammesConsole = lazy(() => import('./components/ProgrammesConsole.jsx'));
// Unified Courses catalog (capsules + ALWE) — loads with the library, no engine code.
import Courses from './components/Courses.jsx';
import { computeReadiness } from './exam.js';
import { resolveTenant } from './tenant.js';

// White-label: limit the catalog to an institution's own courses, if configured.
function filterCatalog(cat, tenant) {
  const f = tenant?.courseFilter;
  if (!f || !f.length) return cat;
  return {
    ...cat,
    capsules: (cat.capsules || []).filter((c) => f.includes(c.course)),
    packs: (cat.packs || []).filter((p) => f.includes(p.course))
  };
}

// Gateway that hosts the AI Processing Engine. Override with VITE_GATEWAY at build time.
const GATEWAY = import.meta.env.VITE_GATEWAY || 'http://localhost:4100';

// Catalog lessons ship with a voice placeholder. When online, point their voice block
// at the gateway's /voice endpoint (it synthesizes + caches any lesson on demand), so
// voice works for ALL lessons, not just AI-generated ones. We don't persist this URL.
function withVoice(capsule) {
  if (!capsule || !navigator.onLine) return capsule;
  const blocks = capsule.blocks.map((b) =>
    b.type === 'voice' && !b.src ? { ...b, src: `${GATEWAY}/voice/${capsule.capsuleId}.ogg` } : b
  );
  return { ...capsule, blocks };
}

function SectionHead({ title, sub }) {
  return <div className="section-head"><h2>{title}</h2>{sub && <p className="lib-sub">{sub}</p>}</div>;
}
function SignInPrompt({ onSignIn, what }) {
  return <div className="signin-prompt"><p>Sign in to {what}.</p><button className="account-btn" onClick={onSignIn}>Sign in</button></div>;
}

export default function App() {
  const [view, setView] = useState('library'); // 'library' (shell) | 'capsule' | 'studio' | 'admin'
  const [section, setSection] = useState('home'); // sidebar section within the shell
  const [navOpen, setNavOpen] = useState(false);   // mobile sidebar drawer
  const [active, setActive] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [library, setLibrary] = useState([]);
  const [packs, setPacks] = useState([]);
  const [busyPackId, setBusyPackId] = useState(null);
  const [packProgress, setPackProgress] = useState(null);
  const [campusSyncing, setCampusSyncing] = useState(false);
  const [campusProgress, setCampusProgress] = useState(null);
  const [offlineStat, setOfflineStat] = useState(null);
  const [readiness, setReadiness] = useState([]);
  const [tenant, setTenant] = useState(null);
  const tenantRef = useRef(null);
  const [catalogSource, setCatalogSource] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [user, setUser] = useState(null);          // signed-in account (null = visitor)
  const [authOpen, setAuthOpen] = useState(false);  // sign-in/up panel

  const [enrolledIds, setEnrolledIds] = useState([]);

  // Restore an existing session on boot (optional login — visitors stay null).
  useEffect(() => { fetchMe().then((u) => u && setUser(u)); }, []);

  // Load enrolments whenever the signed-in user changes.
  useEffect(() => {
    if (user) fetchEnrolments().then(setEnrolledIds);
    else setEnrolledIds([]);
  }, [user]);

  // Deep link: ?join=<code> enrols the signed-in user (or prompts sign-in, then enrols).
  useEffect(() => {
    const join = new URLSearchParams(window.location.search).get('join');
    if (!join) return;
    if (!user) { setAuthOpen(true); return; }
    enrolByCode(join)
      .then(() => fetchEnrolments().then(setEnrolledIds))
      .catch(() => {})
      .finally(() => { const u = new URL(window.location.href); u.searchParams.delete('join'); window.history.replaceState({}, '', u); });
  }, [user]);

  // Enrol a signed-in user by course id or class code (prompts sign-in if a visitor).
  async function enrolAction({ courseId, code }) {
    if (!user) { setAuthOpen(true); throw new Error('auth'); }
    if (code) await enrolByCode(code); else await enrolCourse(courseId);
    setEnrolledIds(await fetchEnrolments());
  }
  // Enrol a signed-in user in a whole programme (all its courses).
  async function enrolProgrammeAction(programmeId) {
    if (!user) { setAuthOpen(true); throw new Error('auth'); }
    const ids = await enrolProgramme(programmeId);
    setEnrolledIds(await fetchEnrolments());
    return ids;
  }
  const [syncing, setSyncing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [published, setPublished] = useState([]);
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioPublishing, setStudioPublishing] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (cat) => {
    const fcat = filterCatalog(cat, tenantRef.current);
    setLibrary(await buildLibrary(fcat));
    setPacks(await buildPacks(fcat));
    setOfflineStat(await offlineStatus(fcat));
    setReadiness(await computeReadiness(fcat));
  }, []);

  // Boot
  useEffect(() => {
    (async () => {
      try {
        const t = await resolveTenant();          // white-label branding + theme
        tenantRef.current = t;
        setTenant(t);
        const { catalog: cat, source } = await fetchCatalog(GATEWAY);
        setCatalog(cat);
        setCatalogSource(source);
        // First run + online: cache the first capsule so the app teaches offline.
        const local = await listCapsules();
        if (local.length === 0 && navigator.onLine && cat.capsules?.length) {
          try { await downloadCapsule(cat.capsules[0].capsuleId, true); } catch { /* offline ok */ }
        }
        await refresh(cat);
      } catch (e) {
        setError('No catalog yet — connect to the internet once to sync.');
      }
    })();
  }, [refresh]);

  // Connectivity
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const openCapsule = useCallback(async (id) => {
    setError(null);
    let cap = await getCapsule(id);
    if (!cap && navigator.onLine) {
      try { cap = await downloadCapsule(id, false, GATEWAY); } catch { /* handled below */ }
    }
    if (!cap) {
      setError('This lesson isn’t downloaded. Connect to the internet to download it.');
      return;
    }
    await touchViewed(id);
    setActive(withVoice(cap));
    setView('capsule');
  }, []);

  const handleDownload = useCallback(async (id) => {
    setError(null);
    try {
      await downloadCapsule(id, true, GATEWAY);
      if (catalog) await refresh(catalog);
    } catch {
      setError('Download failed — check your connection.');
    }
  }, [catalog, refresh]);

  const handleRemove = useCallback(async (id) => {
    await deleteCapsule(id);
    if (catalog) await refresh(catalog);
  }, [catalog, refresh]);

  // Ask Efiko AI to author a lesson for any topic (Stage 5 — server-side generation).
  const handleAsk = useCallback(async (topic) => {
    setAsking(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY}/lessons/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `gateway returned ${res.status}`);
      }
      const { capsule } = await res.json();
      await saveCapsule(capsule, { pinned: true }); // keep it offline too
      setActive(capsule);
      setView('capsule');
    } catch (e) {
      setError(`Efiko AI couldn’t generate that lesson (${e.message}). Is the gateway running?`);
    } finally {
      setAsking(false);
    }
  }, []);

  // Snap & Learn: send a downscaled photo to Claude vision (Stage 7).
  const handleSnap = useCallback(async (dataUrl) => {
    setSnapping(true);
    setError(null);
    try {
      const [meta, b64] = dataUrl.split(',');
      const mediaType = /data:(.*?);/.exec(meta)?.[1] || 'image/jpeg';
      const res = await fetch(`${GATEWAY}/lessons/snap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64, mediaType })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `gateway returned ${res.status}`);
      }
      const { capsule } = await res.json();
      await saveCapsule(capsule, { pinned: true });
      setActive(capsule);
      setView('capsule');
    } catch (e) {
      setError(`Snap & Learn couldn’t read that photo (${e.message}). Is the gateway running?`);
    } finally {
      setSnapping(false);
    }
  }, []);

  // Lesson Packs: download / remove a whole course (Stage 8).
  const handleDownloadPack = useCallback(async (pack) => {
    setBusyPackId(pack.packId);
    setPackProgress({ done: 0, total: pack.total });
    setError(null);
    try {
      await downloadPack(pack, (done, total) => setPackProgress({ done, total }));
      if (catalog) await refresh(catalog);
    } catch {
      setError('Pack download failed — check your connection.');
    } finally {
      setBusyPackId(null);
      setPackProgress(null);
    }
  }, [catalog, refresh]);

  const handleRemovePack = useCallback(async (pack) => {
    await removePack(pack);
    if (catalog) await refresh(catalog);
  }, [catalog, refresh]);

  // Campus Wi-Fi Sync: pull the whole library + voice for 0-MB offline (Stage 11).
  const handleCampusSync = useCallback(async () => {
    setCampusSyncing(true);
    setError(null);
    try {
      const { catalog: cat } = await fetchCatalog();
      setCampusProgress({ done: 0, total: (cat.capsules || []).length });
      await syncCampus(cat, GATEWAY, (done, total) => setCampusProgress({ done, total }));
      await refresh(cat);
    } catch {
      setError('Campus sync failed — check the Wi-Fi connection.');
    } finally {
      setCampusSyncing(false);
      setCampusProgress(null);
    }
  }, [refresh]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const { catalog: cat, source } = await fetchCatalog(GATEWAY);
      setCatalog(cat);
      setCatalogSource(source);
      await syncAll();
      await refresh(cat);
    } catch {
      setError('Sync failed — check your connection.');
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  // --- Lecturer Studio (Stage 12) ---
  const openStudio = useCallback(async () => {
    setView('studio');
    setError(null);
    setPublished(await fetchPublished(GATEWAY));
  }, []);

  const studioGenerate = useCallback(async ({ topic, university, course }) => {
    setStudioBusy(true);
    try {
      const res = await fetch(`${GATEWAY}/lessons/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, university, course })
      });
      if (!res.ok) return null;
      return (await res.json()).capsule;
    } catch {
      return null;
    } finally {
      setStudioBusy(false);
    }
  }, []);

  const studioPublish = useCallback(async (capsule) => {
    setStudioPublishing(true);
    try {
      await publishLesson(GATEWAY, capsule);
      await saveCapsule(capsule, { pinned: true }); // available on this device immediately
      setPublished(await fetchPublished(GATEWAY));
      const { catalog: cat } = await fetchCatalog(GATEWAY);
      setCatalog(cat);
      await refresh(cat);
      return true;
    } catch {
      return false;
    } finally {
      setStudioPublishing(false);
    }
  }, [refresh]);

  const openPublished = useCallback(async (id) => {
    await openCapsule(id);
  }, [openCapsule]);

  // ALWE preview entry point: open ?alwe=<lessonId> to play an Adaptive Learning
  // Whiteboard lesson full-screen (Batch 2 — not yet wired into the product nav).
  const params = new URLSearchParams(window.location.search);
  const alweLesson = params.get('alwe');
  const alweFallback = <div className="app"><p className="alwe-loading">Loading…</p></div>;
  const verifySerial = params.get('verify');
  if (verifySerial) {
    return <VerifyCertificate serial={verifySerial} onExit={() => { window.location.href = window.location.pathname; }} />;
  }
  if (alweLesson) {
    return (
      <div className="app">
        <Suspense fallback={alweFallback}>
          <AlwenPlayer lessonId={alweLesson} onExit={() => { window.location.href = window.location.pathname; }} />
        </Suspense>
      </div>
    );
  }
  if (params.has('alwe-studio')) {
    return (
      <div className="app">
        <Suspense fallback={alweFallback}>
          <AlweStudio onExit={() => { window.location.href = window.location.pathname; }} />
        </Suspense>
      </div>
    );
  }
  if (params.has('classes')) {
    return (
      <div className="app">
        <Suspense fallback={alweFallback}>
          <Classes onExit={() => { window.location.href = window.location.pathname; }} />
        </Suspense>
      </div>
    );
  }
  if (params.has('programmes')) {
    return (
      <div className="app">
        <Suspense fallback={alweFallback}>
          <ProgrammesConsole onExit={() => { window.location.href = window.location.pathname; }} />
        </Suspense>
      </div>
    );
  }

  // A section-change helper: return to the shell and show a section.
  function goSection(id) { setView('library'); setSection(id); setNavOpen(false); setActive(null); }

  function renderSection() {
    switch (section) {
      case 'learn':
        return (<>
          <SectionHead title="Learn" sub="Ask a question, snap a photo of your notes, or explore lessons." />
          <AskEfiko onAsk={handleAsk} busy={asking} />
          <SnapLearn onSnap={handleSnap} busy={snapping} />
        </>);
      case 'thinkspace':
        return (<div className="ts-soon"><h2>🧠 ThinkSpace</h2><p className="lib-sub">Your AI learning workspace — persistent discussions that remember your context. Coming next.</p></div>);
      case 'courses':
        return (<>
          <Programmes onEnrolProgramme={enrolProgrammeAction} />
          <Courses onOpenCapsule={openCapsule} enrolledIds={enrolledIds} onEnrol={enrolAction} signedIn={!!user} />
        </>);
      case 'whiteboard':
        return (<Courses onOpenCapsule={openCapsule} enrolledIds={enrolledIds} onEnrol={enrolAction} signedIn={!!user} adaptiveOnly heading="🎨 Adaptive Whiteboard Lessons" />);
      case 'assessments':
        return (<>
          <SectionHead title="Assessments" sub="Your quiz performance and exam readiness." />
          <ExamReadiness readiness={readiness} />
        </>);
      case 'certificates':
        return user ? <Certificates /> : <SignInPrompt onSignIn={() => setAuthOpen(true)} what="see and claim your certificates" />;
      case 'library':
        return (<>
          <SectionHead title="Library" sub="Everything you've downloaded — available offline." />
          <CampusSync online={online} syncing={campusSyncing} progress={campusProgress} status={offlineStat} onSync={handleCampusSync} />
          <Packs packs={packs} online={online} busyPackId={busyPackId} progress={packProgress} onDownload={handleDownloadPack} onRemove={handleRemovePack} />
          <Library items={library} online={online} catalogSource={catalogSource} syncing={syncing} onOpen={openCapsule} onDownload={handleDownload} onRemove={handleRemove} onSync={handleSync} />
        </>);
      case 'settings':
        return (<div className="settings-page">
          <SectionHead title="Settings" />
          {user
            ? <p className="lib-sub">Signed in as {user.name} ({user.email}). <button className="footer-link" onClick={() => { authLogout(); setUser(null); }}>Sign out</button></p>
            : <p className="lib-sub">You're browsing as a guest. <button className="footer-link" onClick={() => setAuthOpen(true)}>Sign in</button> to save your progress across devices.</p>}
        </div>);
      case 'teach':
        return (<div className="teach-page">
          <SectionHead title="Teach & Institution" sub="Author lessons, run classes and programmes, and manage your institution." />
          <div className="teach-grid">
            <button className="teach-card" onClick={openStudio}>📝 Lecturer Studio<span>Generate & publish lessons</span></button>
            <button className="teach-card" onClick={() => { window.location.href = `${window.location.pathname}?alwe-studio`; }}>🎨 Whiteboard Studio<span>Author adaptive lessons</span></button>
            <button className="teach-card" onClick={() => { window.location.href = `${window.location.pathname}?classes`; }}>👥 Classes<span>Rosters & class progress</span></button>
            <button className="teach-card" onClick={() => { window.location.href = `${window.location.pathname}?programmes`; }}>🧭 Programmes<span>Group courses into tracks</span></button>
            <button className="teach-card" onClick={() => setView('admin')}>🏛️ Institution Admin<span>Branding & account</span></button>
          </div>
        </div>);
      case 'home':
      default:
        return (<>
          {user
            ? <div className="efiko-greeting"><h2>👋 Hi {user.name.split(' ')[0]}, what do you want to learn today?</h2><p>Ask EFIKO AI above, or jump back in below.</p></div>
            : <div className="efiko-greeting"><h2>Learn anything, anywhere — even offline.</h2><p>Ask EFIKO AI above, or explore courses. <button className="footer-link" onClick={() => setAuthOpen(true)}>Sign in</button> to save your progress.</p></div>}
          <div className="home-quick">
            <button className="quick-card" onClick={() => goSection('learn')}>✦ Ask & Learn</button>
            <button className="quick-card" onClick={() => goSection('courses')}>📚 Courses</button>
            <button className="quick-card" onClick={() => goSection('whiteboard')}>🎨 Whiteboard</button>
            <button className="quick-card" onClick={() => goSection('assessments')}>📝 Assessments</button>
          </div>
          <ExamReadiness readiness={readiness} />
          {user && <Certificates />}
        </>);
    }
  }

  return (
    <div className={`app shell ${navOpen ? 'nav-open' : ''}`}>
      <TopBar
        logo={tenant?.logo} name={tenant?.name} institution={tenant?.institution}
        user={user} online={online} asking={asking}
        onAsk={handleAsk}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={() => { authLogout(); setUser(null); }}
        onMenu={() => setNavOpen((o) => !o)}
      />
      {authOpen && (
        <AuthPanel
          onAuthed={(u) => { setUser(u); setAuthOpen(false); setView('library'); setSection('home'); }}
          onClose={() => setAuthOpen(false)}
        />
      )}
      <div className="shell-body">
        <Sidebar active={view === 'library' ? section : null} onSelect={goSection} onTeach={() => goSection('teach')} />
        {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
        <main className="app-main">
          {error && <p className="error">{error}</p>}
          {view === 'capsule' && active ? (
            <>
              <button className="back" onClick={() => { setView('library'); setActive(null); if (catalog) computeReadiness(catalog).then(setReadiness); }}>← Back</button>
              <CapsuleView capsule={active} />
            </>
          ) : view === 'studio' ? (
            <Studio onGenerate={studioGenerate} onPublish={studioPublish} onOpenPublished={openPublished} onBack={() => goSection('teach')} published={published} busy={studioBusy} publishing={studioPublishing} />
          ) : view === 'admin' ? (
            <AdminPanel onBack={() => goSection('teach')} />
          ) : (
            renderSection()
          )}
        </main>
      </div>
    </div>
  );
}
