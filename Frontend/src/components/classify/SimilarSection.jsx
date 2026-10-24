// Frontend/src/components/classify/SimilarSection.jsx
import { resolveImageUrl } from '../../lib/api.js';

export default function SimilarSection({ images }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="similar-section">
      <h4>Visually similar leaves (by feature vector)</h4>
      <div className="similar-grid">
        {images.map((img, i) => (
          <div className="similar-item" key={`${img.image_url}-${i}`}>
            <img src={resolveImageUrl(img.image_url)} alt={`${img.label} reference leaf`} loading="lazy" />
            <div className="similar-caption">
              <strong>{img.label}</strong>
              {Math.round((img.similarity || 0) * 100)}% match
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}