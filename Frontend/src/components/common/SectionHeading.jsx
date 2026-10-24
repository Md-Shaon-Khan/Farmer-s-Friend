// Frontend/src/components/common/SectionHeading.jsx
import Reveal from './Reveal.jsx';

export default function SectionHeading({ label, title, lead, as: H = 'h2' }) {
  return (
    <Reveal>
      {label && <div className="label">{label}</div>}
      <H>{title}</H>
      {lead && <p className="lead">{lead}</p>}
    </Reveal>
  );
}
