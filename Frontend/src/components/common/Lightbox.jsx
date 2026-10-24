// Frontend/src/components/common/Lightbox.jsx
import { useEffect, useRef } from 'react';

export default function Lightbox({ image, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (image && !d.open) d.showModal();
    if (!image && d.open) d.close();
  }, [image]);

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label="Enlarged chart"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <button type="button" className="lb-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      {image && <img src={image.src} alt={image.alt} />}
    </dialog>
  );
}