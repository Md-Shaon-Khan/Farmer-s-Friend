// Frontend/src/components/home/HowItWorks.jsx
import Reveal from '../common/Reveal.jsx';
import SafeImage from '../common/SafeImage.jsx';

const STEPS = [
  { n: '01', title: 'Take a photo', text: 'One leaf, in daylight, close up.' },
  { n: '02', title: 'Upload it', text: 'Add the photo on the Classify page.' },
  { n: '03', title: 'Read the result', text: 'Disease name, affected spots and similar leaves.' },
];

export default function HowItWorks() {
  return (
    <section className="sec two" id="how">
      <Reveal className="photo">
        <SafeImage src="/assets/images/paddy.jpg" alt="Paddy field" />
      </Reveal>
      <div className="caps">
        <Reveal><div className="label">How to use it</div></Reveal>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 110} className="cap">
            <span className="n">{s.n}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}