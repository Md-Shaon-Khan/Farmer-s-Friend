// Frontend/src/pages/HomePage.jsx
import Hero from '../components/home/Hero.jsx';
import DiseaseExplorer from '../components/home/DiseaseExplorer.jsx';
import FeatureCards from '../components/home/FeatureCards.jsx';
import HowItWorks from '../components/home/HowItWorks.jsx';
import AboutSection from '../components/home/AboutSection.jsx';
import EvidenceCharts from '../components/home/EvidenceCharts.jsx';
import CtaBand from '../components/home/CtaBand.jsx';

export default function HomePage() {
  return (
    <>
      <Hero />
      <DiseaseExplorer />
      <FeatureCards />
      <HowItWorks />
      <AboutSection />
      <EvidenceCharts />
      <CtaBand />
    </>
  );
}