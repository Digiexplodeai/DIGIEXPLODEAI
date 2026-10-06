import React from 'react';
import { siteConfig } from '../config/site';
import { ArrowRight, Code, Laptop, Rocket, Users, CheckCircle, Sparkles } from 'lucide-react';
import SEOHead from '../components/SEO/SEOHead';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
  return (
    <div className="transition-colors" style={{ paddingTop: '80px', background: 'var(--bg-page)' }}>
      <SEOHead
        title="About DigiexplodeAI — Premier Digital Marketing & Creative Tech Agency"
        description="Learn about the DigiexplodeAI team, mission, technology stack, and how we turn ambitious client ideas into explosive market leaders."
        keywords="About DigiexplodeAI, Engineering Team, Web Agency Mission, Tech Experts"
        canonicalUrl="https://digiexplode.ai/about"
      />

      {/* Hero */}
      <section style={{ background: 'var(--bg-page)', padding: 'clamp(64px,9vw,110px) 0' }}>
        <div className="editorial-container">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#5546F5]/10 text-[#5546F5] border border-[#5546F5]/20">
            <Sparkles size={13} />
            <span>Our Mission & Story</span>
          </div>

          <h1 className="display-xl mb-6 max-w-3xl" style={{ color: 'var(--text-primary)' }}>
            We build digital engines that{' '}
            <span className="text-gradient-violet">empower</span>{' '}
            market leaders.
          </h1>
          
          <p className="body-lg max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            DigiexplodeAI is a collective of performance marketers, media buyers, UI/UX designers, and software engineers dedicated to measurable digital dominance.
          </p>
        </div>
      </section>

      {/* Stats + Image */}
      <section className="border-t" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', padding: 'clamp(60px,8vw,100px) 0' }}>
        <div className="editorial-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <div className="rounded-3xl overflow-hidden shadow-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
                <img
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=800"
                  alt="Our Strategy Team"
                  className="w-full object-cover aspect-[4/3]"
                />
              </div>
            </div>

            <div>
              <h2 className="display-md mb-4" style={{ color: 'var(--text-primary)' }}>
                Relentless Focus on Client ROI
              </h2>
              
              <p className="body-lg mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Founded on the belief that mediocre digital presence is invisible. We deliver top-tier creative and performance marketing by uniting scientific media buying with world-class engineering and brand storytelling.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {[
                  { num: '150+', label: 'Campaigns Launched', col: '#5546F5' },
                  { num: '4.8x', label: 'Average ROAS', col: '#FF784F' },
                  { num: '10M+', label: 'Total Reach', col: '#B8F36B' },
                  { num: '24/7', label: 'Partner Support', col: '#5546F5' },
                ].map(s => (
                  <div key={s.num} className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="font-extrabold text-3xl sm:text-4xl font-mono leading-none mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      {s.num}
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/start-project" className="btn-primary">
                Start a Project <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Values — Dark midnight navy */}
      <section style={{ background: 'var(--midnight-navy)', padding: 'clamp(64px,8vw,100px) 0', color: '#FFFFFF' }}>
        <div className="editorial-container">
          <div className="mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B8F36B] block mb-2">Core Pillars</span>
            <h2 className="display-md text-white m-0">How we engineer unfair advantage</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10 border-t border-b border-white/10">
            {[
              { Icon: Users, title: 'Direct-Response Creative', desc: 'Crafting high-converting ad visuals and video hooks engineered to capture attention.' },
              { Icon: Laptop, title: 'Speed & Conversion CRO', desc: 'Engineering sub-second web applications and frictionless checkout funnels.' },
              { Icon: Code, title: 'Modern Tech Stack', desc: 'Powered by React, TypeScript, Next.js, and Google Gemini AI integrations.' },
              { Icon: Rocket, title: 'Disciplined Scaling', desc: 'Data-backed budget allocation targeting sustainable, compounding multi-channel ROAS.' },
            ].map(({ Icon, title, desc }, i) => (
              <div key={title} className="p-6 sm:p-8">
                <Icon size={28} className="text-[#5546F5] mb-4" />
                <h3 className="font-extrabold text-lg text-white mb-2">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed m-0">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
