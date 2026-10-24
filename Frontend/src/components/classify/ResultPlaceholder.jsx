// Frontend/src/components/classify/ResultPlaceholder.jsx
export default function ResultPlaceholder({ analyzing }) {
  if (analyzing) {
    return (
      <div className="result-placeholder busy">
        <div className="spinner" aria-hidden="true" />
        <p>Analyzing your leaf…</p>
        <div className="skeleton-lines" aria-hidden="true"><span /><span /><span /></div>
      </div>
    );
  }
  return (
    <div className="result-placeholder">
      <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true" className="ph-leaf">
        <path d="M16 29V14M16 14C16 7 11 4 5 4c0 7 4 10 11 10zM16 18c0-6 4-9 11-9 0 7-4 10-11 10z" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p>Your result will appear here.</p>
    </div>
  );
}