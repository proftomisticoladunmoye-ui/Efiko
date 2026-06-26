// Efiko — Stage 3 app shell: offline-first router over the Offline Engine.
// Boot: get the catalog (network → cache fallback), seed one capsule on first run
// so there is offline content, then show "My Courses". Lessons open from IndexedDB.
import { useEffect, useState, useCallback } from 'react';
import { fetchCatalog, buildLibrary, syncAll, downloadCapsule, buildPacks, downloadPack, removePack, syncCampus, offlineStatus, publishLesson, fetchPublished } from './sync/syncEngine.js';
import { getCapsule, listCapsules, deleteCapsule, touchViewed, saveCapsule } from './storage/capsuleStore.js';
import CapsuleView from './components/CapsuleView.jsx';
import Library from './components/Library.jsx';
import Packs from './components/Packs.jsx';
import CampusSync from './components/CampusSync.jsx';
import AskEfiko from './components/AskEfiko.jsx';
import SnapLearn from './components/SnapLearn.jsx';
import Studio from './components/Studio.jsx';
import StatusBar from './components/StatusBar.jsx';

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

export default function App() {
  const [view, setView] = useState('library'); // 'library' | 'capsule'
  const [active, setActive] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [library, setLibrary] = useState([]);
  const [packs, setPacks] = useState([]);
  const [busyPackId, setBusyPackId] = useState(null);
  const [packProgress, setPackProgress] = useState(null);
  const [campusSyncing, setCampusSyncing] = useState(false);
  const [campusProgress, setCampusProgress] = useState(null);
  const [offlineStat, setOfflineStat] = useState(null);
  const [catalogSource, setCatalogSource] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [published, setPublished] = useState([]);
  const [studioBusy, setStudioBusy] = useState(false);
  const [studioPublishing, setStudioPublishing] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (cat) => {
    setLibrary(await buildLibrary(cat));
    setPacks(await buildPacks(cat));
    setOfflineStat(await offlineStatus(cat));
  }, []);

  // Boot
  useEffect(() => {
    (async () => {
      try {
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

  return (
    <div className="app">
      <StatusBar source={view === 'capsule' ? 'offline cache (IndexedDB)' : null} />
      <header className="brandbar">
        <img className="brandbar-logo" src="/logo.png" alt="Efiko" width="180" />
      </header>
      <main className="app-main">
        {error && <p className="error">{error}</p>}

        {view === 'library' && <AskEfiko onAsk={handleAsk} busy={asking} />}
        {view === 'library' && <SnapLearn onSnap={handleSnap} busy={snapping} />}

        {view === 'library' && (
          <CampusSync
            online={online}
            syncing={campusSyncing}
            progress={campusProgress}
            status={offlineStat}
            onSync={handleCampusSync}
          />
        )}

        {view === 'library' && (
          <Packs
            packs={packs}
            online={online}
            busyPackId={busyPackId}
            progress={packProgress}
            onDownload={handleDownloadPack}
            onRemove={handleRemovePack}
          />
        )}

        {view === 'library' && (
          <Library
            items={library}
            online={online}
            catalogSource={catalogSource}
            syncing={syncing}
            onOpen={openCapsule}
            onDownload={handleDownload}
            onRemove={handleRemove}
            onSync={handleSync}
          />
        )}

        {view === 'capsule' && active && (
          <>
            <button className="back" onClick={() => { setView('library'); setActive(null); }}>
              ← My Courses
            </button>
            <CapsuleView capsule={active} />
          </>
        )}

        {view === 'studio' && (
          <Studio
            onGenerate={studioGenerate}
            onPublish={studioPublish}
            onOpenPublished={openPublished}
            onBack={() => setView('library')}
            published={published}
            busy={studioBusy}
            publishing={studioPublishing}
          />
        )}
      </main>
      <footer className="app-footer">
        Efiko · multi-channel learning ecosystem
        {view !== 'studio' && (
          <> · <button className="footer-link" onClick={openStudio}>Lecturer Studio</button></>
        )}
      </footer>
    </div>
  );
}
