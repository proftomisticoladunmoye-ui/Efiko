// Efiko — Snap & Learn (Stage 7). Photograph notes / a slide / a book page;
// Claude vision reads it and authors a lesson. The image is downscaled in the
// browser before upload to respect the data budget.
import { useRef } from 'react';

async function downscale(file, maxDim, quality) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality); // data:image/jpeg;base64,...
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SnapLearn({ onSnap, busy }) {
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await downscale(file, 1024, 0.8);
    onSnap(dataUrl);
  };

  return (
    <div className="snap">
      <button className="snap-btn" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Reading your photo…' : '📸 Snap & Learn — photograph notes or a slide'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
  );
}
