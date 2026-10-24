// Frontend/src/components/home/Hero.jsx
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';
import BangladeshMap from './BangladeshMap.jsx';

export default function Hero() {
  return (
    <section className="hero">
      <span className="blob b1" aria-hidden="true" />
      <span className="blob b2" aria-hidden="true" />

      <div className="hero-copy">
        <Reveal><div className="label">Rice leaf disease detection</div></Reveal>
        <Reveal delay={80}>
          <h1>
            Not sure what is wrong with your <span className="grad">rice leaf?</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="hero-text">
            Blast, brown spot and blight look alike when you are standing in the field. Send one
            photo and Paddy Check tells you what it thinks it is, and where on the leaf.
          </p>
        </Reveal>
        <Reveal delay={240} className="cta-row">
          <Button to="/classify">Classify a leaf</Button>
          <Button variant="out" href="#groups">Read about the diseases</Button>
        </Reveal>
        <Reveal delay={320}>
          <ul className="hero-stats">
            <li><b>8</b><span>conditions</span></li>
            <li><b>Heatmap</b><span>shows where</span></li>
            <li><b>0</b><span>sign-ups needed</span></li>
          </ul>
        </Reveal>
      </div>

      <Reveal delay={120} className="hero-map">
        <BangladeshMap />
      </Reveal>
    </section>
  );
}