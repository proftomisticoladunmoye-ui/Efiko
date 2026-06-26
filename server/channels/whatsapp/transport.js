// Efiko — WhatsApp transport. Abstracts the wire so the rest of the system never
// knows whether we're live or mocked (Stage 1 §6: start on Cloud API, swappable).
// No credentials → MOCK transport (returns what WOULD be sent) so everything is
// fully testable locally. Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID to go live.
// Read lazily (at call time), so values are present AFTER loadEnv() runs — module
// constants would evaluate during import, before .env is loaded. Trim tolerates
// stray whitespace from hand-edited .env files.
const TOKEN = () => (process.env.WHATSAPP_TOKEN || '').trim();
const PHONE_ID = () => (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
const GRAPH = () => (process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com/v19.0').trim();

export function isLive() {
  return Boolean(TOKEN() && PHONE_ID());
}

function toCloudPayload(to, m) {
  if (m.type === 'image') {
    return { messaging_product: 'whatsapp', to, type: 'image', image: { link: m.link, caption: m.caption } };
  }
  if (m.type === 'audio') {
    return { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: m.link } };
  }
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body: String(m.body ?? '') } };
}

// Download an inbound WhatsApp media object (e.g. a Snap & Learn photo) as base64.
// Two-step per the Cloud API: resolve the media URL, then fetch the bytes (both
// authenticated). Returns null in mock mode (no token).
export async function fetchMediaBase64(mediaId) {
  if (!isLive()) return null;
  const meta = await fetch(`${GRAPH()}/${mediaId}`, { headers: { Authorization: `Bearer ${TOKEN()}` } });
  if (!meta.ok) throw new Error('media meta ' + meta.status);
  const { url, mime_type } = await meta.json();
  const bin = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN()}` } });
  if (!bin.ok) throw new Error('media bytes ' + bin.status);
  const buf = Buffer.from(await bin.arrayBuffer());
  return { base64: buf.toString('base64'), mime: mime_type || 'image/jpeg' };
}

export async function sendMessages(to, messages) {
  if (!isLive()) {
    // Mock: echo what would be delivered. Useful for the simulator and tests.
    return messages.map((m) => ({ to, mock: true, ...m }));
  }
  const results = [];
  for (const m of messages) {
    const res = await fetch(`${GRAPH()}/${PHONE_ID()}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toCloudPayload(to, m))
    });
    results.push({ to, type: m.type, status: res.status });
  }
  return results;
}
