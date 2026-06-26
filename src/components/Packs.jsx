// Efiko — Lesson Packs (Stage 8). Download a whole course as one offline bundle.
export default function Packs({ packs, online, busyPackId, progress, onDownload, onRemove }) {
  if (!packs || packs.length === 0) return null;

  return (
    <section className="packs">
      <h2>Lesson Packs</h2>
      <p className="packs-sub">Download a whole course at once for offline study.</p>

      {packs.map((p) => {
        const busy = busyPackId === p.packId;
        const pct = busy && progress
          ? Math.round((progress.done / progress.total) * 100)
          : Math.round((p.downloaded / p.total) * 100);
        return (
          <div key={p.packId} className="pack-row">
            <div className="pack-info">
              <span className="pack-title">{p.title}</span>
              <span className="pack-meta">
                {p.total} lessons · {p.sizeKB} KB · {busy ? (progress?.done ?? 0) : p.downloaded}/{p.total} offline
              </span>
              <div className="pack-bar"><div className="pack-bar-fill" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="pack-actions">
              {p.complete && !busy ? (
                <button className="ghost" onClick={() => onRemove(p)}>Remove</button>
              ) : (
                <button disabled={!online || busy} onClick={() => onDownload(p)}>
                  {busy ? `${progress?.done ?? 0}/${p.total}…` : (online ? 'Download' : 'Offline')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
