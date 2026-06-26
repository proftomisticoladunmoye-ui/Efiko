// Efiko core — Budget Enforcer (Stage 1 §5), WhatsApp profile.
// Non-bypassable: every outbound message passes through here. WhatsApp text caps at
// 4096 chars; we split on paragraph boundaries so a lesson never fails to send, and
// we keep the whole session lightweight (the data-minimisation ethos).
export const WA_TEXT_LIMIT = 4096;

export function enforceBudget(messages) {
  const out = [];
  for (const m of messages) {
    if (m.type === 'text' && m.body.length > WA_TEXT_LIMIT) {
      let body = m.body;
      while (body.length > WA_TEXT_LIMIT) {
        let cut = body.lastIndexOf('\n', WA_TEXT_LIMIT);
        if (cut < 1) cut = WA_TEXT_LIMIT;
        out.push({ type: 'text', body: body.slice(0, cut).trimEnd() });
        body = body.slice(cut).trimStart();
      }
      out.push({ type: 'text', body });
    } else {
      out.push(m);
    }
  }
  return out;
}

/** Rough byte estimate of a rendered message list (telemetry / data-budget checks). */
export function estimateKB(messages) {
  const bytes = messages.reduce((n, m) => n + Buffer.byteLength(m.body || m.caption || '', 'utf8'), 0);
  return Math.max(1, Math.round(bytes / 1024));
}
