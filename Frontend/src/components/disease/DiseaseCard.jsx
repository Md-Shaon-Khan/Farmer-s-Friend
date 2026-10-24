// Frontend/src/components/disease/DiseaseCard.jsx
import Reveal from '../common/Reveal.jsx';

export default function DiseaseCard({ item, delay = 0 }) {
  return (
    <Reveal as="article" delay={delay} className="dis">
      <div>
        <h3>{item.name}</h3>
        <small>{item.sci}</small>
      </div>
      <dl>
        <dt>Looks like</dt>
        <dd>{item.looks}</dd>
        <dt>Good to know</dt>
        <dd>{item.good}</dd>
      </dl>
    </Reveal>
  );
}