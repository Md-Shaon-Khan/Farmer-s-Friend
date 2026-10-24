// Frontend/src/pages/ClassifyPage.jsx
import useClassifier from '../hooks/useClassifier.js';
import usePasteImage from '../hooks/usePasteImage.js';
import SupportedConditions from '../components/classify/SupportedConditions.jsx';
import UploadCard from '../components/classify/UploadCard.jsx';
import ResultPlaceholder from '../components/classify/ResultPlaceholder.jsx';
import ResultCard from '../components/classify/ResultCard.jsx';
import FeedbackBox from '../components/classify/FeedbackBox.jsx';
import Reveal from '../components/common/Reveal.jsx';

export default function ClassifyPage() {
  const c = useClassifier();
  usePasteImage({ onImage: c.selectFile, onError: c.setError });

  return (
    <>
      <section className="chead">
        <Reveal><div className="label">Classify</div></Reveal>
        <Reveal delay={80}><h1>Classify a leaf</h1></Reveal>
        <Reveal delay={160}>
          <p className="lead">
            Upload one clear photo of a single paddy leaf and see what disease it may have.
          </p>
        </Reveal>
        <Reveal delay={220}><SupportedConditions /></Reveal>
      </section>

      <div className="cgrid">
        <UploadCard
          previewUrl={c.previewUrl}
          phase={c.phase}
          hasFile={!!c.file}
          error={c.error}
          onFile={c.selectFile}
          onAnalyze={c.analyze}
          onReset={c.reset}
        />

        <section className="rcard" aria-live="polite">
          {c.phase === 'done' && c.result ? (
            <>
              <ResultCard data={c.result} />
              {c.result.prediction_id && (
                <FeedbackBox key={c.result.prediction_id} predictionId={c.result.prediction_id} />
              )}
            </>
          ) : (
            <ResultPlaceholder analyzing={c.phase === 'analyzing'} />
          )}
        </section>
      </div>
    </>
  );
}