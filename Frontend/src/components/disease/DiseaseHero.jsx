// Frontend/src/components/disease/DiseaseHero.jsx
import Reveal from '../common/Reveal.jsx';
import Button from '../common/Button.jsx';

export default function DiseaseHero({ group }) {
  return (
    <section className="dhero">
      <Reveal><div className="label">Disease guide</div></Reveal>
      <Reveal delay={80}><h1>{group.name}</h1></Reveal>
      <Reveal delay={160}><p className="lead">{group.lead}</p></Reveal>
      <Reveal delay={240} className="cta-row">
        <Button to="/classify">Classify a leaf</Button>
      </Reveal>
    </section>
  );
}