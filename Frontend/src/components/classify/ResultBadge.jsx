// Frontend/src/components/classify/ResultBadge.jsx
// kind: paddy | not-paddy | healthy | diseased | mismatch
export default function ResultBadge({ kind, children }) {
  return <span className={`result-status is-${kind}`}>{children}</span>;
}