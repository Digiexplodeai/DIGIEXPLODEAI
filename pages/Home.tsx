import React from 'react';
import Hero from '../components/Sections/Hero';
import ProofStrip from '../components/Sections/ProofStrip';
import ServicesGrid from '../components/Sections/ServicesGrid';
import RoiCalculator from '../components/Sections/RoiCalculator';
import Marquee from '../components/Sections/Marquee';
import ResultsSection from '../components/Sections/ResultsSection';
import ProjectsGrid from '../components/Sections/ProjectsGrid';
import CreativeGallery from '../components/Sections/CreativeGallery';
import Process from '../components/Sections/Process';
import Pricing from '../components/Sections/Pricing';
import Testimonials from '../components/Sections/Testimonials';
import ContactForm from '../components/Sections/ContactForm';
import SEOHead from '../components/SEO/SEOHead';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      <SEOHead
        title="DigiexplodeAI — Performance Marketing & Creative Technology Agency"
        description="DigiexplodeAI is a premier digital agency engineering high-ROAS Meta and Google Ads campaigns, bespoke high-converting web apps, and viral creative engines for ambitious brands."
        keywords="DigiexplodeAI, Performance Marketing Agency, Meta Ads, Google Ads, SEO Dominance, Web Development, ROI Calculator"
        canonicalUrl="https://digiexplode.ai/"
      />
      <Hero />
      <ProofStrip />
      <ServicesGrid />
      <RoiCalculator />
      <Marquee />
      <ResultsSection />
      <ProjectsGrid limit={4} />
      <CreativeGallery />
      <Process />
      <Pricing />
      <Testimonials />
      <ContactForm />
    </div>
  );
};

export default Home;
