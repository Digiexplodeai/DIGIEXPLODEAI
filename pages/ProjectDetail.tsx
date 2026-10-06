import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ExternalLink, MessageSquare, Sparkles } from 'lucide-react';
import { projects } from '../data/projects';
import { siteConfig } from '../config/site';
import SEOHead from '../components/SEO/SEOHead';

const ProjectDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const project = projects.find(p => p.slug === slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!project) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center text-center p-6 transition-colors"
        style={{ background: 'var(--bg-page)' }}
      >
        <div className="card-modern max-w-md p-8 rounded-2xl border">
          <h2 className="display-sm mb-4" style={{ color: 'var(--text-primary)' }}>Project Not Found</h2>
          <p className="body-md mb-6" style={{ color: 'var(--text-secondary)' }}>The requested case study could not be located.</p>
          <Link to="/projects" className="btn-primary">Back to All Projects</Link>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="transition-colors pb-24"
      style={{ 
        background: 'var(--bg-page)',
        paddingTop: '100px',
      }}
    >
      <SEOHead
        title={`${project.title} — Case Study | DigiexplodeAI`}
        description={project.description}
        canonicalUrl={`https://digiexplode.ai/projects/${project.slug}`}
      />

      <div className="editorial-container">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-bold transition-colors mb-8 cursor-pointer hover:text-[#5546F5]"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#5546F5]/10 text-[#5546F5] border border-[#5546F5]/20">
              <Sparkles size={13} />
              <span>Case Study · {project.category}</span>
            </div>

            <h1 className="display-lg tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
              {project.title}
            </h1>

            <p className="text-lg leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
              {project.fullDescription || project.description}
            </p>
            
            {/* Tech Stack */}
            <div className="flex flex-wrap gap-2 mb-8">
              {project.techStack.map(tech => (
                <span 
                  key={tech} 
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {tech}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link to="/start-project" className="btn-primary">
                Start Similar Project
              </Link>
              <a 
                href={siteConfig.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                <MessageSquare size={15} /> WhatsApp Consult
              </a>
            </div>
          </div>
          
          {/* Featured Image */}
          <div className="lg:col-span-6 relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl border aspect-[4/3]" style={{ borderColor: 'var(--border-subtle)' }}>
              <img 
                src={project.image} 
                alt={project.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Floating result card */}
            <div 
              className="absolute -bottom-6 -left-6 p-6 rounded-2xl shadow-xl border hidden md:block max-w-xs"
              style={{
                background: 'var(--midnight-navy)',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
              }}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#B8F36B] block mb-1">
                Verified Outcome
              </span>
              <p className="font-extrabold text-lg text-white m-0 leading-snug">{project.outcome}</p>
            </div>
          </div>
        </div>

        {/* 3-Column Detailed Breakdown: Problem, Solution, Features */}
        <div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {/* Problem */}
          <div className="card-modern rounded-2xl p-6 border">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 text-red-500 flex items-center justify-center font-bold text-sm mb-4">
              !
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              The Challenge
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {project.problem}
            </p>
          </div>

          {/* Solution */}
          <div className="card-modern rounded-2xl p-6 border">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center font-bold text-sm mb-4">
              ✓
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Strategic Solution
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {project.solution}
            </p>
          </div>

          {/* Key Deliverables & Features */}
          <div className="card-modern rounded-2xl p-6 border">
            <div className="w-8 h-8 rounded-lg bg-[#5546F5]/15 text-[#5546F5] flex items-center justify-center font-bold text-sm mb-4">
              ★
            </div>
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Deliverables & Specs
            </h3>
            <ul className="flex flex-col gap-2.5 p-0 m-0 list-none">
              {project.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs sm:text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  <CheckCircle2 size={15} className="text-[#5546F5] flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProjectDetail;
