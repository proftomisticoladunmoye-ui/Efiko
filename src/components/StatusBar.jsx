// Efiko — connectivity + offline-source indicator.
// Proves the philosophy visibly: when offline, the capsule still loads from cache.
import { useEffect, useState } from 'react';

export default function StatusBar({ source }) {
  const [online, setOnline] = useState(navigator.onLine);

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

  return (
    <div className={`statusbar ${online ? 'is-online' : 'is-offline'}`}>
      <span className="dot" />
      {online ? 'Online' : 'Offline'}
      {source && <span className="source"> · served from {source}</span>}
    </div>
  );
}
