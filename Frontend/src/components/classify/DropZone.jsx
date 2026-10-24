// Frontend/src/components/classify/DropZone.jsx
import { useRef, useState } from 'react';

export default function DropZone({ previewUrl, analyzing, onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const stop = (e) => e.preventDefault();

  return (
    <div
      className={`dropzone ${dragging ? 'is-dragover' : ''} ${previewUrl ? 'has-preview' : ''}`}
      onDragEnter={(e) => { stop(e); setDragging(true); }}
      onDragOver={(e) => { stop(e); setDragging(true); }}
      onDragLeave={(e) => { stop(e); setDragging(false); }}
      onDrop={(e) => {
        stop(e);
        setDragging(false);
        const f = e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      {previewUrl ? (
        <div className="preview">
          <img src={previewUrl} alt="Selected leaf preview" />
          {analyzing && <span className="scan" aria-hidden="true" />}
        </div>
      ) : (
        <div className="drop-empty">
          <span className="drop-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
            </svg>
          </span>
          <strong>Drop a leaf photo here</strong>
          <span>JPG or PNG · or copy an image and press Ctrl+V</span>
          <button type="button" className="btn out sm" onClick={() => inputRef.current?.click()}>
            Choose a photo
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) onFile(e.target.files[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}