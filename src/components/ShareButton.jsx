// EFIKO — social share button for Originals. Shares the course's public, crawlable SEO page
// (/courses/<title-slug>, which carries Open Graph tags for rich link previews) so every share
// is a growth loop: friends see a real course page and can start it in one tap. On mobile it
// opens the native share sheet (navigator.share → WhatsApp, X, etc.); on desktop it falls back
// to an explicit menu of social targets + copy-link.
import { useState } from 'react';

// Must match the SEO slug in seo/originals.mjs so the link resolves to the prerendered page.
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function courseShareUrl(course) {
  const base = (typeof window !== 'undefined' && window.location.origin) || 'https://efikolearn.online';
  return `${base}/courses/${slugify(course.title)}`;
}

export default function ShareButton({ course, label = 'Share', message }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = courseShareUrl(course);
  const text = message || `I'm learning “${course.title}” — a free certificate course on EFIKO. Learn anywhere, understand everything:`;
  const enc = encodeURIComponent;
  const u = enc(url);
  const t = enc(text);

  const targets = [
    { name: 'WhatsApp', emoji: '🟢', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { name: 'X', emoji: '𝕏', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { name: 'Facebook', emoji: '📘', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { name: 'LinkedIn', emoji: '💼', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: 'Telegram', emoji: '✈️', href: `https://t.me/share/url?url=${u}&text=${t}` }
  ];

  async function onShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: course.title, text, url }); } catch { /* cancelled */ }
      return;
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* clipboard blocked */ }
  }

  return (
    <div className="share-wrap">
      <button type="button" className="course-share-btn" onClick={onShare}>🔗 {label}</button>
      {open && (
        <div className="share-menu" role="menu">
          {targets.map((x) => (
            <a key={x.name} className="share-target" href={x.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>{x.emoji} {x.name}</a>
          ))}
          <button type="button" className="share-target" onClick={copy}>{copied ? '✓ Link copied' : '🔗 Copy link'}</button>
        </div>
      )}
    </div>
  );
}
