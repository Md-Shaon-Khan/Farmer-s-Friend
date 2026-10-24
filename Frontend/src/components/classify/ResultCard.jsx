// Frontend/src/components/classify/ResultCard.jsx
import ResultBadge from './ResultBadge.jsx';
import ConfidenceRow from './ConfidenceRow.jsx';
import TopCandidates from './TopCandidates.jsx';
import LocalizationSection from './LocalizationSection.jsx';
import SimilarSection from './SimilarSection.jsx';

export default function ResultCard({ data }) {
  const notPaddy = !data.is_paddy;
  const paddyBadge = notPaddy ? (
    <ResultBadge kind="not-paddy">Not paddy</ResultBadge>
  ) : (
    <ResultBadge kind="paddy">Paddy confirmed</ResultBadge>
  );
  const notPaddyNote = notPaddy ? (
    <p className="result-note">
      This doesn't look like a paddy leaf (paddy confidence{' '}
      {Math.round((data.paddy_confidence || 0) * 100)}%). The prediction below is shown for
      testing only and may be unreliable.
    </p>
  ) : null;

  // Backend skipped the disease step for non-paddy photos
  if (notPaddy && !data.final && data.disease_confidence == null) {
    return (
      <div className="result-inner">
        {paddyBadge}
        <h3>This doesn't look like a paddy leaf</h3>
        <p className="result-note">Try a closer photo of a single leaf, filling most of the frame.</p>
        <ConfidenceRow label="Confidence" value={data.paddy_confidence} />
      </div>
    );
  }

  const sub = data.sub_class || null;
  const final = data.final || null;

  // Healthy leaf
  if (!final) {
    return (
      <div className="result-inner">
        {paddyBadge}
        <ResultBadge kind="healthy">Looks healthy</ResultBadge>
        <h3>No disease detected</h3>
        {notPaddyNote}
        <p className="result-note">The leaf looks healthy based on this photo.</p>
        <ConfidenceRow label="Paddy" value={data.paddy_confidence} />
        <ConfidenceRow label="Healthy" value={data.disease_confidence} />
        <SimilarSection images={data.similar_images} />
      </div>
    );
  }

  // Diseased or unlisted
  const isUnlisted = final.group === 'other' || data.disease === 'unsupported_condition';
  const showGroupLine = !isUnlisted && final.group_label !== final.label;

  return (
    <div className="result-inner">
      {paddyBadge}
      {isUnlisted ? (
        <ResultBadge kind="mismatch">Unlisted condition</ResultBadge>
      ) : (
        <ResultBadge kind="diseased">Disease found</ResultBadge>
      )}

      <h3>{final.label}</h3>
      {showGroupLine && <p className="result-group">{final.group_label}</p>}
      {notPaddyNote}
      {isUnlisted && data.message && <div className="result-alert-box">{data.message}</div>}

      <p className="result-note">
        This is a model estimate — confirm with an expert before treating your crop.
      </p>

      <ConfidenceRow label="Paddy" value={data.paddy_confidence} />
      <ConfidenceRow
        label={isUnlisted ? 'Condition: Unlisted' : `Disease: ${final.label}`}
        value={final.confidence}
      />

      <TopCandidates sub={sub} />
      <LocalizationSection localization={data.localization} />
      <SimilarSection images={data.similar_images} />
    </div>
  );
}