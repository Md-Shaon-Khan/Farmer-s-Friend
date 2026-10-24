// Frontend/src/components/home/CtaBand.jsx
import Reveal from '../common/Reveal.jsx';
import Button from '../common/Button.jsx';

export default function CtaBand() {
  return (
    <Reveal as="section" className="band">
      <h2>Got a leaf that looks odd?</h2>
      <p>One clear photo is enough to start.</p>
      <Button to="/classify">Classify a leaf</Button>
    </Reveal>
  );
}