// Frontend/src/components/home/FeatureCards.jsx
import Reveal from '../common/Reveal.jsx';

const FEATURES = [
  { n: 1, title: 'Names the disease', text: 'A trained model picks from the common paddy leaf diseases.' },
  { n: 2, title: 'Shows where', text: 'A heatmap and boxes mark the part of the leaf it is looking at.' },
  {
    n: 3,
    title: 'Real cases',
    text: 'See similar leaves from our reference gallery and compare with yours.',
    photo: '/assets/images/paddy.jpg',
  },
  { n: 4, title: 'Made for a phone', text: 'One photo is enough. No account, nothing to install.' },
];

export default function FeatureCards() {
  return (
    <section className="sec">
      <div className="cards4">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.n}
            delay={i * 90}
            className={`fc ${f.photo ? 'ph' : ''}`}
            style={f.photo ? { backgroundImage: `url(${f.photo})` } : undefined}
          >
            <span className="ic">{f.n}</span>
            <div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}