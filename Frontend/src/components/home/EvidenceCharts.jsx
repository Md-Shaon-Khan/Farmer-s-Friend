// Frontend/src/components/home/EvidenceCharts.jsx
import { useState } from 'react';
import SectionHeading from '../common/SectionHeading.jsx';
import Reveal from '../common/Reveal.jsx';
import SafeImage from '../common/SafeImage.jsx';
import Lightbox from '../common/Lightbox.jsx';

const CHARTS = [
  {
    src: '/assets/images/boxplot2.png',
    alt: 'Boxplot of model results by disease',
    title: 'Boxplot',
    text: 'One box per disease. A short box that sits high means the model scored well on most photos. A tall box means it was less steady.',
  },
  {
    src: '/assets/images/heatmap2.png',
    alt: 'Heatmap of model results',
    title: 'Heatmap',
    text: 'Rows are the real disease, columns are what the model guessed. Dark squares on the diagonal are right answers. Dark squares elsewhere show what it mixes up.',
  },
];

export default function EvidenceCharts() {
  const [open, setOpen] = useState(null);

  return (
    <section className="sec">
      <SectionHeading
        label="Test results"
        title="How well does it work?"
        lead="These two charts come from our own testing. Tap one to open it bigger."
      />
      <div className="evg">
        {CHARTS.map((c, i) => (
          <Reveal key={c.title} as="figure" delay={i * 120} className="cc">
            <button type="button" className="co" onClick={() => setOpen(c)}>
              <span className="ci">
                <SafeImage src={c.src} alt={c.alt} loading="lazy" />
              </span>
            </button>
            <figcaption>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </figcaption>
          </Reveal>
        ))}
      </div>
      <Lightbox image={open} onClose={() => setOpen(null)} />
    </section>
  );
}