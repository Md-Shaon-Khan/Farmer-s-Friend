// Frontend/src/components/classify/TopCandidates.jsx
export default function TopCandidates({ sub }) {
  if (!sub || !sub.top3 || sub.top3.length < 2) return null;
  return (
    <div className="top-candidates">
      <h4>Other possibilities</h4>
      <ul>
        {sub.top3.map((c) => (
          <li key={c.label}>
            {c.label} <span>{Math.round(c.confidence * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}