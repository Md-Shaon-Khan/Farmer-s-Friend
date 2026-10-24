// Frontend/src/components/disease/OtherGroups.jsx
import { Link } from 'react-router-dom';
import Reveal from '../common/Reveal.jsx';
import { GROUPS } from '../../data/diseases.js';

export default function OtherGroups({ current }) {
  return (
    <Reveal as="section" className="sec">
      <div className="label">Other groups</div>
      <div className="pills pills-flat">
        {GROUPS.filter((g) => g.key !== current).map((g) => (
          <Link key={g.key} className="pill" to={`/${g.key}`}>{g.tag}</Link>
        ))}
      </div>
    </Reveal>
  );
}