// Frontend/src/components/disease/FactsGrid.jsx
import Reveal from '../common/Reveal.jsx';

export default function FactsGrid({ group }) {
  return (
    <section className="sec facts">
      <Reveal className="box">
        <h3>What you may see</h3>
        <ul>{group.see.map((t) => <li key={t}>{t}</li>)}</ul>
      </Reveal>
      <Reveal delay={120} className="box">
        <h3>What farmers usually do</h3>
        <ul>{group.todo.map((t) => <li key={t}>{t}</li>)}</ul>
      </Reveal>
    </section>
  );
}