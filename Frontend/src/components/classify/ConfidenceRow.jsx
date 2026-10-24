// Frontend/src/components/classify/ConfidenceRow.jsx
import { useEffect, useState } from 'react';

export default function ConfidenceRow({ label, value }) {
  const pct = Math.round((value ?? 0) * 100);
  const [w, setW] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  if (value === undefined || value === null) return null;

  return (
    <div className="confidence-row">
      <span className="confidence-label">{label}</span>
      <span className="confidence-track">
        <span className="confidence-fill" style={{ width: `${w}%` }} />
      </span>
      <span className="confidence-value">{pct}%</span>
    </div>
  );
}