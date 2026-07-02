// EFIKO 2.0 — Export engine (R4). Dependency-free exports: Markdown, plain text, Word
// (.doc = Word-openable HTML), and Print → Save as PDF (browser print of a clean window).
// Turns a ThinkSpace discussion (messages + generated resources) into a shareable document.

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeName = (s) => String(s || 'efiko').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'efiko';

function download(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---- content builders ----
function resourceToMd(r) {
  if (r.type === 'summary') return `## Summary\n\n${r.data.text || ''}\n`;
  if (r.type === 'flashcards') return `## Flashcards\n\n${(r.data.items || []).map((f) => `- **${f.front}** — ${f.back}`).join('\n')}\n`;
  if (r.type === 'quiz') return `## Quiz\n\n${(r.data.items || []).map((q, i) => `${i + 1}. ${q.q}\n${(q.options || []).map((o, j) => `   - ${o}${j === q.answer ? '  ✓' : ''}`).join('\n')}`).join('\n\n')}\n`;
  return '';
}
export function discussionToMarkdown(d) {
  let md = `# ${d.title || 'Discussion'}\n\n`;
  for (const m of (d.messages || [])) md += `**${m.role === 'ai' ? 'Efiko' : 'You'}:** ${m.text}\n\n`;
  for (const r of (d.resources || [])) md += `${resourceToMd(r)}\n`;
  return md.trim() + '\n';
}
function resourceToHtml(r) {
  if (r.type === 'summary') return `<h2>Summary</h2><p>${esc(r.data.text)}</p>`;
  if (r.type === 'flashcards') return `<h2>Flashcards</h2><ul>${(r.data.items || []).map((f) => `<li><strong>${esc(f.front)}</strong> — ${esc(f.back)}</li>`).join('')}</ul>`;
  if (r.type === 'quiz') return `<h2>Quiz</h2><ol>${(r.data.items || []).map((q) => `<li>${esc(q.q)}<ul>${(q.options || []).map((o, j) => `<li>${j === q.answer ? '<strong>' : ''}${esc(o)}${j === q.answer ? '</strong> ✓' : ''}</li>`).join('')}</ul></li>`).join('')}</ol>`;
  return '';
}
export function discussionToHtml(d) {
  const body = [`<h1>${esc(d.title || 'Discussion')}</h1>`]
    .concat((d.messages || []).map((m) => `<p><strong>${m.role === 'ai' ? 'Efiko' : 'You'}:</strong> ${esc(m.text)}</p>`))
    .concat((d.resources || []).map(resourceToHtml))
    .join('\n');
  return body;
}

// ---- exporters ----
export function exportMarkdown(d) { download(`${safeName(d.title)}.md`, 'text/markdown;charset=utf-8', discussionToMarkdown(d)); }
export function exportText(d) { download(`${safeName(d.title)}.txt`, 'text/plain;charset=utf-8', discussionToMarkdown(d)); }
export function exportWord(d) {
  const html = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>${esc(d.title)}</title></head><body style="font-family:Georgia,serif">${discussionToHtml(d)}</body></html>`;
  download(`${safeName(d.title)}.doc`, 'application/msword', html);
}
export function printPdf(d) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset='utf-8'><title>${esc(d.title)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;line-height:1.6;padding:0 16px;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:20px}</style></head><body>${discussionToHtml(d)}</body></html>`);
  w.document.close(); w.focus();
  setTimeout(() => w.print(), 300);
}
