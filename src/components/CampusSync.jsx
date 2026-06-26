// Efiko — Campus Wi-Fi Sync (Stage 11). One tap on campus Wi-Fi pulls the whole
// library — lessons + voice notes — into the device for true 0-MB offline study.
export default function CampusSync({ online, syncing, progress, status, onSync }) {
  const complete = status && status.total > 0 && status.capsules === status.total && status.voice === status.total;
  const pct = syncing && progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="campus">
      <div className="campus-info">
        <span className="campus-title">📶 Campus Wi-Fi Sync</span>
        <span className="campus-sub">
          {complete
            ? '✓ Whole library saved for offline — lessons & voice. Learn on 0 MB.'
            : 'On campus Wi-Fi? Save every lesson and voice note for offline study.'}
        </span>
        {status && (
          <span className="campus-meta">
            {status.capsules}/{status.total} lessons · {status.voice}/{status.total} voice offline
          </span>
        )}
        {syncing && (
          <div className="campus-bar"><div className="campus-bar-fill" style={{ width: `${pct}%` }} /></div>
        )}
      </div>
      <button className="campus-btn" disabled={!online || syncing || complete} onClick={onSync}>
        {syncing ? `${progress?.done ?? 0}/${progress?.total ?? 0}…` : complete ? 'Synced' : (online ? 'Sync all' : 'Offline')}
      </button>
    </section>
  );
}
