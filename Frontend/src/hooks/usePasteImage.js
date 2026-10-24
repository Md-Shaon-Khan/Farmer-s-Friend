// Frontend/src/hooks/usePasteImage.js
import { useEffect } from 'react';

async function imageFileFromClipboard(clipboardData) {
  for (const item of clipboardData.items || []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  const html = clipboardData.getData('text/html');
  let url = '';
  if (html) {
    const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
    if (img) url = img.getAttribute('src') || '';
  }
  if (!url) url = (clipboardData.getData('text/plain') || '').trim();

  if (/^(data:image\/|https?:\/\/)/i.test(url)) {
    const res = await fetch(url);
    const blob = await res.blob();
    if (blob.type.startsWith('image/')) {
      const ext = blob.type.split('/')[1].split('+')[0] || 'png';
      return new File([blob], `pasted-image.${ext}`, { type: blob.type });
    }
  }
  return null;
}

export default function usePasteImage({ onImage, onError }) {
  useEffect(() => {
    const handler = async (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!e.clipboardData) return;

      try {
        const file = await imageFileFromClipboard(e.clipboardData);
        if (!file) {
          onError('No image found in the clipboard. Copy an image first, then press Ctrl+V.');
          return;
        }
        onImage(file);
      } catch (err) {
        console.error(err);
        onError(
          "Couldn't read that image from the clipboard. Right-click it and choose 'Copy image', or save it and upload."
        );
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [onImage, onError]);
}