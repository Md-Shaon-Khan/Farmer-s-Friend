// Frontend/src/components/classify/SupportedConditions.jsx
const CONDITIONS = [
  'Bacterial Leaf Blight',
  'Bacterial Leaf Streak',
  'Blast',
  'Brown Spot',
  'Sheath Blight',
  'Tungro',
  'False Smut',
  'Healthy Leaf',
];

export default function SupportedConditions() {
  return (
    <div className="supported">
      <strong>Supported conditions</strong>
      <ul>
        {CONDITIONS.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <p><em>Any other condition will be marked as unlisted or low confidence.</em></p>
    </div>
  );
}