// EFIKO — verifiable certificate card (premium design). A formal, printable certificate with
// an ornate gold frame, laurel-wreath score, "Verified Certificate" seal, competencies, a
// signature block and a QR code linking to the public verification page. Used by the
// Certificates section and the EFIKO Originals completion screen.
import { useEffect, useState } from 'react';
import qrcode from 'qrcode-generator';
import ShareButton, { linkedInCertUrl } from './ShareButton.jsx';

const GOLD = '#c9a24a';
const GOLD_D = '#a67c2e';
const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
export const verifyUrl = (serial) => `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(serial)}`;

// Load the decorative fonts once (graceful serif/script fallback offline).
function useCertFonts() {
  useEffect(() => {
    const id = 'efiko-cert-fonts';
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Pinyon+Script&display=swap';
    document.head.appendChild(l);
  }, []);
}

// A curved run of laurel leaves along an arc.
function laurel(cx, cy, r, from, to, n, flip) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = from + (to - from) * (n === 1 ? 0 : i / (n - 1));
    const rad = (t * Math.PI) / 180;
    const x = cx + r * Math.cos(rad), y = cy + r * Math.sin(rad);
    const rot = t + (flip ? 110 : 70);
    out.push(<ellipse key={i} cx={x} cy={y} rx="6.5" ry="2.6" fill={GOLD} transform={`rotate(${rot} ${x} ${y})`} />);
  }
  return out;
}

const CornerFlourish = () => (
  <svg className="cert-corner-svg" viewBox="0 0 70 70" aria-hidden="true">
    <path d="M6 40 V12 a6 6 0 0 1 6-6 H40" fill="none" stroke={GOLD_D} strokeWidth="2.5" />
    <path d="M13 34 V16 a3 3 0 0 1 3-3 H34" fill="none" stroke={GOLD} strokeWidth="1.2" />
    <circle cx="9" cy="9" r="2.4" fill={GOLD_D} />
    <path d="M34 13 q10 0 12 10" fill="none" stroke={GOLD} strokeWidth="1.2" />
  </svg>
);

const VerifiedSeal = () => (
  <svg className="cert-seal" viewBox="0 0 96 128" aria-label="Verified certificate">
    <path d="M14 2 H82 V104 L48 86 L14 104 Z" fill="#12233f" />
    <path d="M14 2 H82 V104 L48 86 L14 104 Z" fill="none" stroke={GOLD} strokeWidth="1.5" />
    <circle cx="48" cy="46" r="30" fill="none" stroke={GOLD} strokeWidth="1.5" />
    {laurel(48, 46, 30, 100, 200, 7, false)}
    {laurel(48, 46, 30, 80, -20, 7, true)}
    <text x="48" y="40" textAnchor="middle" fill={GOLD} style={{ font: '700 11px Cinzel, serif', letterSpacing: '1px' }}>VERIFIED</text>
    <text x="48" y="54" textAnchor="middle" fill="#fff" style={{ font: '600 8px Cinzel, serif', letterSpacing: '.5px' }}>CERTIFICATE</text>
    <g fill={GOLD}>
      <path d="M40 64 l1.3 2.7 3 .4 -2.1 2 .5 3 -2.7-1.4 -2.7 1.4 .5-3 -2.1-2 3-.4z" />
      <path d="M48 66 l1.3 2.7 3 .4 -2.1 2 .5 3 -2.7-1.4 -2.7 1.4 .5-3 -2.1-2 3-.4z" />
      <path d="M56 64 l1.3 2.7 3 .4 -2.1 2 .5 3 -2.7-1.4 -2.7 1.4 .5-3 -2.1-2 3-.4z" />
    </g>
  </svg>
);

const ScoreWreath = ({ score }) => (
  <div className="cert-score-wrap">
    <span className="cert-rule-side left" />
    <svg className="cert-score-svg" viewBox="0 0 120 90" aria-hidden="true">
      {laurel(60, 48, 40, 150, 250, 8, false)}
      {laurel(60, 48, 40, 30, -70, 8, true)}
      <text x="60" y="56" textAnchor="middle" fill="#12233f" style={{ font: '700 24px Cinzel, serif' }}>{score}%</text>
    </svg>
    <span className="cert-rule-side right" />
  </div>
);

const Check = () => (
  <svg className="cert-check" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill={GOLD_D} /><path d="M6 10.5 l2.5 2.5 L14.5 7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function CertificateCard({ cert, onClose }) {
  useCertFonts();
  const [qrSvg, setQrSvg] = useState('');
  const url = verifyUrl(cert.serial);
  useEffect(() => {
    try { const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); setQrSvg(qr.createSvgTag({ cellSize: 3, margin: 1, scalable: true })); }
    catch { setQrSvg(''); }
  }, [url]);

  const name = cert.userName || cert.name;
  const comps = cert.competencies || [];
  const host = (() => { try { return new URL(url).host; } catch { return 'efikolearn.online'; } })();

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="cert-doc" onClick={(e) => e.stopPropagation()}>
        {onClose && <button className="auth-close cert-close" onClick={onClose} aria-label="Close">×</button>}
        <div className="cert-print" id="cert-print">
          <div className="cert-frame">
            <span className="cert-corner tl"><CornerFlourish /></span>
            <span className="cert-corner tr"><CornerFlourish /></span>
            <span className="cert-corner bl"><CornerFlourish /></span>
            <span className="cert-corner br"><CornerFlourish /></span>
            <div className="cert-seal-wrap"><VerifiedSeal /></div>

            <img className="cert-logo" src="/logo.png" alt="Efiko" />
            <div className="cert-title">CERTIFICATE</div>
            <div className="cert-oa">OF ACHIEVEMENT</div>

            <p className="cert-line">This certifies that</p>
            <div className="cert-name">{name}</div>
            <div className="cert-name-rule" />
            <p className="cert-line">has successfully completed the course</p>
            <div className="cert-course">{cert.courseTitle}</div>

            {cert.score != null && (<><p className="cert-line">with a score of</p><ScoreWreath score={cert.score} /></>)}

            {comps.length > 0 && (
              <>
                <div className="cert-divider"><span>◆</span> COMPETENCIES ACHIEVED <span>◆</span></div>
                <ul className="cert-comp-grid">{comps.map((c, i) => <li key={i}><Check /><span>{c}</span></li>)}</ul>
              </>
            )}

            <div className="cert-footer">
              <div className="cert-foot-col left">
                <span className="cert-date">{fmt(cert.issuedAt)}</span>
                <span className="cert-foot-label">DATE COMPLETED</span>
              </div>
              <div className="cert-foot-col mid">
                <span className="cert-sign">Efiko Team</span>
                <span className="cert-foot-label">{cert.issuer || 'EFIKO'}</span>
              </div>
              <div className="cert-foot-col right">
                {qrSvg && <div className="cert-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
                <span className="cert-qr-cap">Verify this certificate</span>
                <span className="cert-qr-url">{host}/verify</span>
              </div>
            </div>

            <div className="cert-issue">Issued by {cert.issuer || 'EFIKO'}{cert.hours ? `  ·  ${cert.hours} learning hours` : ''}</div>
            <div className="cert-serial">Serial No. {cert.serial}</div>
          </div>
        </div>
        <div className="cert-actions">
          <button className="course-open" onClick={() => window.print()}>Print / Save PDF</button>
          <a className="course-share-btn cert-linkedin" href={linkedInCertUrl(cert, url)} target="_blank" rel="noreferrer">💼 Add to LinkedIn</a>
          <ShareButton url={url} title={cert.courseTitle} label="Share" message={`I earned a verifiable certificate in “${cert.courseTitle}” from EFIKO! 🎓 Learn a skill and get certified too:`} />
          <a className="course-share-btn" href={url} target="_blank" rel="noreferrer">Verify link</a>
        </div>
      </div>
    </div>
  );
}
