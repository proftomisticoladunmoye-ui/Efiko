// EFIKO — per-course Open Graph image generator (1200×630 PNG). Social crawlers
// (Facebook, LinkedIn, X, WhatsApp) require a RASTER image, so each Original gets its own
// branded card rendered at build time. The SVG layout + text wrapping here are pure and
// tested; the SVG→PNG rasterization uses @resvg/resvg-js, which is an OPTIONAL dependency —
// scripts/build-seo.mjs only calls generateOgPng when it and a font are actually available,
// and always falls back to the site logo otherwise, so the build can never break.
import { SITE } from './site.mjs';

export const OG_W = 1200;
export const OG_H = 630;

const xesc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Greedy word-wrap to at most `maxLines` lines of about `maxChars` characters. The last line
// is ellipsized if the title doesn't fit. Pure + deterministic (unit-tested below).
export function wrapTitle(text, maxChars = 20, maxLines = 3) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // If we ran out of lines but still had words, ellipsize the last visible line.
  const usedWords = lines.join(' ').split(/\s+/).length;
  if (usedWords < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > maxChars - 1 && last.includes(' ')) last = last.slice(0, last.lastIndexOf(' '));
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

// Build the 1200×630 SVG for a course card. Deliberately emoji-free (the bundled font renders
// plain glyphs only) — the "star" is a drawn path so it always shows.
export function courseOgSvg(course, { fontFamily = 'DejaVu Sans' } = {}) {
  const title = course.title || 'EFIKO Original';
  const lines = wrapTitle(title, title.length > 40 ? 24 : 18, 3);
  const titleSize = lines.length >= 3 ? 74 : lines.length === 2 ? 88 : 104;
  const lineH = titleSize * 1.14;
  const titleTop = 250 - ((lines.length - 1) * lineH) / 2;

  const metaBits = [
    'Free certificate course',
    course.level,
    course.estimatedHours && `${course.estimatedHours}h`,
    `${(course.sessions || []).length} sessions`
  ].filter(Boolean).join('   ·   ');

  const titleTspans = lines
    .map((ln, i) => `<tspan x="90" y="${Math.round(titleTop + i * lineH)}">${xesc(ln)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#0f2c2a"/>
    </linearGradient>
  </defs>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="${OG_H}" fill="#14b8a6"/>
  <g font-family="${xesc(fontFamily)}">
    <g transform="translate(90,96)">
      <path d="M18 0 L23.5 12.4 L37 13.8 L27 23 L29.7 36.3 L18 29.6 L6.3 36.3 L9 23 L-1 13.8 L12.5 12.4 Z" fill="#f5b301"/>
      <text x="52" y="28" font-size="30" font-weight="700" fill="#8ff3e6" letter-spacing="2">EFIKO ORIGINAL</text>
    </g>
    <text font-size="${titleSize}" font-weight="700" fill="#ffffff">${titleTspans}</text>
    <text x="90" y="470" font-size="34" fill="#9fb3c8">${xesc(metaBits)}</text>
    <text x="90" y="566" font-size="30" font-weight="700" fill="#14b8a6">efikolearn.online</text>
    <text x="90" y="566" dx="330" font-size="28" fill="#7a8ba0">${xesc(SITE.tagline)}</text>
  </g>
</svg>`;
}

// Rasterize an SVG string to a PNG Buffer using an injected Resvg class + font buffers.
// Kept dependency-free at import time so this module always loads.
export function svgToPng(svg, { Resvg, fontBuffers = [], fontFamily = 'DejaVu Sans' }) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_W },
    // Prefer the bundled font buffers; fall back to the builder's system fonts (Render's
    // Ubuntu image ships DejaVu) so rendering still works if the font package is absent.
    font: { fontBuffers, defaultFontFamily: fontFamily, loadSystemFonts: true }
  });
  return r.render().asPng();
}
