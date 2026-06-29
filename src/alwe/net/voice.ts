// EFIKO ALWE — fetch one narration segment's audio from the gateway (Deepgram Opus).
// Used by the DownloadManager to pre-fetch and store clips for offline playback.
const GATEWAY = (import.meta.env.VITE_GATEWAY as string) || 'http://localhost:4100';

export async function fetchSegmentAudio(text: string): Promise<Blob> {
  const res = await fetch(`${GATEWAY}/alwe/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { error?: string }).error || `voice synthesis failed (${res.status})`);
  }
  return res.blob();
}
