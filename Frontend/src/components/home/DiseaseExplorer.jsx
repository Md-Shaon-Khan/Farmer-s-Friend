// Frontend/src/components/home/DiseaseExplorer.jsx
import { useState } from 'react';
import SectionHeading from '../common/SectionHeading.jsx';
import Button from '../common/Button.jsx';
import Reveal from '../common/Reveal.jsx';
import { GROUPS } from '../../data/diseases.js';

export default function DiseaseExplorer() {
  const [active, setActive] = useState(GROUPS[0].key);
  const g = GROUPS.find((x) => x.key === active);

  return (
    <section className="sec two" id="groups">
      <div className="explorer-intro">
        <SectionHeading
          label="Disease guide"
          title="Find out which kind of problem it is"
          lead="Every disease falls into one of a few groups. Pick one to see the signs and what farmers usually do."
        />
        <Reveal delay={120} className="pills" role="tablist" aria-label="Disease groups">
          {GROUPS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={x.key === active}
              className={`pill ${x.key === active ? 'on' : ''}`}
              onClick={() => setActive(x.key)}
            >
              {x.tag}
            </button>
          ))}
        </Reveal>
      </div>

      <Reveal delay={160} className="flow">
        <div className="flow-body" key={g.key}>
          <div className="top">
            <h3>Disease group</h3>
            <span className="tagb">{g.tag}</span>
          </div>
          <p>{g.summary}</p>
          <ul>
            {g.examples.map((e) => (
              <li key={e.name}>{e.name}</li>
            ))}
          </ul>
        </div>
        <div className="go">
          <Button to={`/${g.key}`}>Open this page</Button>
        </div>
      </Reveal>
    </section>
  );
}