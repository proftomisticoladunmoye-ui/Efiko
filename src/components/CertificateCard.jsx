// EFIKO — verifiable certificate card (shared). Renders a printable certificate with a QR
// code linking to its public verification page, plus competencies, learning hours, issuer
// and serial. Used by the Certificates section and the EFIKO Originals completion screen.
import { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';

const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');
export const verifyUrl = (serial) => `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(serial)}`;

export default function CertificateCard({ cert, onClose }) {
  const [qrSvg, setQrSvg] = useState('');
  const url = verifyUrl(cert.serial);
  useEffect(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      setQrSvg(qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }));
    } catch { setQrSvg(''); }
  }, [url]);

  const name = cert.userName || cert.name;
  const comps = cert.competencies || [];

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="cert-doc" onClick={(e) => e.stopPropagation()}>
        {onClose && <button className="auth-close" onClick={onClose} aria-label="Close">×</button>}
        <div className="cert-print" id="cert-print">
          <img className="cert-logo" src="/logo.png" alt="Efiko" width="140" />
          <p className="cert-kicker">Certificate of Achievement</p>
          <p className="cert-awarded">This certifies that</p>
          <h3 className="cert-name">{name}</h3>
          <p className="cert-awarded">has successfully completed</p>
          <h4 className="cert-course">{cert.courseTitle}</h4>
          {cert.score != null && <p className="cert-score">with a score of {cert.score}%</p>}
          {comps.length > 0 && (
            <div className="cert-comps">
              <p className="cert-comps-h">Competencies achieved</p>
              <ul>{comps.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
          <div className="cert-foot">
            <div className="cert-foot-meta">
              <p className="cert-date">{fmt(cert.issuedAt)}{cert.hours ? ` · ${cert.hours} learning hours` : ''}</p>
              <p className="cert-serial">Issued by {cert.issuer || 'EFIKO'} · Serial {cert.serial}</p>
            </div>
            {qrSvg && <div className="cert-qr" title="Scan to verify" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
          </div>
        </div>
        <div className="cert-actions">
          <button className="course-open" onClick={() => window.print()}>Print / Save PDF</button>
          <a className="course-share-btn" href={url} target="_blank" rel="noreferrer">Verify link</a>
        </div>
      </div>
    </div>
  );
}
