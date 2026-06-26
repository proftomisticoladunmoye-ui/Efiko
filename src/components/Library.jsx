// Efiko — "My Courses": the offline library. Shows every lesson in the catalog
// with its cache state, and lets the student download (pin), open, or remove it.
export default function Library({
  items, online, catalogSource, syncing,
  onOpen, onDownload, onRemove, onSync
}) {
  // Group capsules by university + course.
  const courses = {};
  for (const it of items) {
    const key = `${it.university} · ${it.course}`;
    (courses[key] ||= []).push(it);
  }

  const courseKeys = Object.keys(courses);

  return (
    <div className="library">
      <div className="lib-head">
        <h2>My Courses</h2>
        <button className="sync-btn" disabled={syncing || !online} onClick={onSync}>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
      <p className="lib-sub">
        Catalog: {catalogSource === 'cache' ? 'offline copy' : 'up to date'}
        {' · '}{online ? 'online' : 'offline — cached lessons still open'}
      </p>

      {courseKeys.length === 0 && (
        <p className="empty">No lessons yet. Connect once to sync the catalog.</p>
      )}

      {courseKeys.map((course) => (
        <section key={course} className="course">
          <h3>{course}</h3>
          {courses[course]
            .sort((a, b) => a.sequence - b.sequence)
            .map((it) => (
              <div key={it.capsuleId} className="cap-row">
                <div className="cap-info">
                  <span className="cap-topic">{it.topic}</span>
                  <span className="cap-meta">
                    Capsule {it.sequence} · {it.durationMin} min · {it.sizeKB} KB
                  </span>
                  <span className="cap-tags">
                    {it.pinned && <span className="tag tag-pin">Downloaded</span>}
                    {it.cached && !it.pinned && <span className="tag">Cached</span>}
                    {!it.cached && <span className="tag tag-cloud">Not downloaded</span>}
                    {it.updateAvailable && <span className="tag tag-upd">Update</span>}
                  </span>
                </div>
                <div className="cap-actions">
                  {it.cached ? (
                    <button onClick={() => onOpen(it.capsuleId)}>Open</button>
                  ) : (
                    <button disabled={!online} onClick={() => onDownload(it.capsuleId)}>
                      {online ? 'Download' : 'Offline'}
                    </button>
                  )}
                  {it.cached && (
                    <button className="ghost" onClick={() => onRemove(it.capsuleId)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
