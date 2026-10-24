// Frontend/src/components/home/AboutSection.jsx
import Reveal from '../common/Reveal.jsx';
import Button from '../common/Button.jsx';

export default function AboutSection() {
  return (
    <section className="sec about">
      <Reveal><div className="label">About</div></Reveal>
      <Reveal delay={100}>
        <h2>Most farmers can't call an expert every time they see a spot.</h2>
        <p>
          Sometimes the officer is far away, or busy, and the crop does not wait. We wanted
          something that works from a phone photo and gives a first idea quickly. It is not a
          doctor, just a second pair of eyes to help you decide what to do next.
        </p>
        <Button variant="out" to="/classify">Try it now</Button>
      </Reveal>
    </section>
  );
}