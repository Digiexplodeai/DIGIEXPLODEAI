import React from 'react';
import ProjectsGrid from '../components/Sections/ProjectsGrid';
import SEOHead from '../components/SEO/SEOHead';
import { Sparkles } from 'lucide-react';

const Projects: React.FC = () => {
  return (
    <div className="transition-colors" style={{ paddingTop: '80px', background: 'var(--bg-page)' }}>
      <SEOHead
        title="Our Featured Works & Case Studies | DigiexplodeAI Portfolio"
        description="Explore the DigiexplodeAI portfolio of custom web apps, mobile solutions, direct-response ad sets, and explosive digital marketing campaigns engineered for high ROI."
        keywords="DigiexplodeAI Projects, Web App Portfolio, Mobile Apps Case Studies, UI UX Showcase"
        canonicalUrl="https://digiexplode.ai/projects"
      />

      {/* Page Header */}
      <section 
        className="border-b"
        style={{ 
          background: 'var(--bg-page)', 
          borderColor: 'var(--border-subtle)',
          padding: 'clamp(56px, 8vw, 96px) 0' 
        }}
      >
        <div className="editorial-container">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#FF784F]/10 text-[#FF784F] border border-[#FF784F]/20">
            <Sparkles size={13} />
            <span>Case Study Directory</span>
          </div>

          <h1 className="display-xl mb-4 max-w-2xl" style={{ color: 'var(--text-primary)' }}>
            Campaigns & engineering portfolio.
          </h1>

          <p className="body-lg max-w-lg" style={{ color: 'var(--text-secondary)' }}>
            Each project represents disciplined craftsmanship and verified client results. No templates, no fabricated data.
          </p>
        </div>
      </section>

      <ProjectsGrid showFilter={true} />
    </div>
  );
};

export default Projects;
