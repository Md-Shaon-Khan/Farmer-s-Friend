// Frontend/src/components/classify/UploadCard.jsx
import DropZone from './DropZone.jsx';
import Button from '../common/Button.jsx';

const TIPS = ['Use daylight, not flash.', 'Fill the frame with one leaf.', 'Keep the photo sharp, not blurry.'];

export default function UploadCard({
  previewUrl, phase, hasFile, error, onFile, onAnalyze, onReset,
}) {
  const analyzing = phase === 'analyzing';
  const done = phase === 'done';

  return (
    <section className="ucard">
      <DropZone previewUrl={previewUrl} analyzing={analyzing} onFile={onFile} />

      {done ? (
        <Button variant="out" className="full" onClick={onReset}>Check another photo</Button>
      ) : (
        <Button className="full" disabled={!hasFile || analyzing} onClick={onAnalyze}>
          {analyzing ? 'Analyzing…' : 'Analyze photo'}
        </Button>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <ol className="tips">
        {TIPS.map((t, i) => (
          <li key={t}><span className="n">{i + 1}</span>{t}</li>
        ))}
      </ol>
    </section>
  );
}