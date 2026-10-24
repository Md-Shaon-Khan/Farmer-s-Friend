// Frontend/src/pages/DiseasePage.jsx
import DiseaseHero from '../components/disease/DiseaseHero.jsx';
import FactsGrid from '../components/disease/FactsGrid.jsx';
import DiseaseCard from '../components/disease/DiseaseCard.jsx';
import OtherGroups from '../components/disease/OtherGroups.jsx';
import SectionHeading from '../components/common/SectionHeading.jsx';

export default function DiseasePage({ group }) {
  return (
    <>
      <DiseaseHero group={group} />
      <FactsGrid group={group} />

      <section className="sec">
        <SectionHeading label="Examples" title="Common ones" />
        <div className="dis-list">
          {group.examples.map((e, i) => (
            <DiseaseCard key={e.name} item={e} delay={i * 90} />
          ))}
        </div>
      </section>

      <OtherGroups current={group.key} />
    </>
  );
}