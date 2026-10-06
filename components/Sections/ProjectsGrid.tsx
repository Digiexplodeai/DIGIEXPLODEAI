import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { projects } from '../../data/projects';
import ScrollReveal from '../UI/ScrollReveal';

const categoryTabs = ['All', 'Website', 'Web App', 'Mobile App', 'E-Commerce'];

const ProjectsGrid: React.FC<{ limit?: number; showFilter?: boolean }> = ({ limit, showFilter = true }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = activeCategory === 'All'
    ? projects
    : projects.filter(p => {
        if (activeCategory === 'E-Commerce') return p.category.includes('Commerce') || p.slug.includes('ecommerce');
        return p.category.toLowerCase().includes(activeCategory.toLowerCase());
      });

  const displayed = limit ? filtered.slice(0, limit) : filtered;

  return (
    <section 
      id="work" 
      className="transition-colors"
      style={{ 
        background: 'var(--bg-page)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      <div className="editorial-container">

        {/* Section Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#FF5A5F]/10 text-[#FF5A5F] border border-[#FF5A5F]/20">
                <Sparkles size={13} />
                <span>Selected Case Studies</span>
              </div>
              <h2 className="display-lg" style={{ color: 'var(--text-primary)' }}>
                Work that moved <br />
                <span className="text-gradient-creative">the needle.</span>
              </h2>
            </div>

            {limit && (
              <Link to="/projects" className="btn-outline group self-start md:self-end">
                All Case Studies ({projects.length}) <ArrowUpRight size={16} className="arrow-shift-hover" />
              </Link>
            )}
          </div>
        </ScrollReveal>

        {/* Category Filters */}
        {showFilter && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
            {categoryTabs.map((tab) => {
              const isActive = activeCategory === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveCategory(tab)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border"
                  style={{
                    background: isActive ? '#11131D' : 'var(--bg-card)',
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    borderColor: isActive ? '#11131D' : 'var(--border-subtle)',
                    boxShadow: isActive ? '0 4px 14px rgba(17, 19, 29, 0.2)' : 'none',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        )}

        {/* Editorial Asymmetric Projects List */}
        <div className="flex flex-col gap-8">
          {displayed.map((p, idx) => {
            const isFeaturedLead = idx === 0 && !limit;
            const isEven = idx % 2 === 0;
            const isHovered = hoveredId === p.id;

            return (
              <ScrollReveal key={p.id} direction="up" delay={idx * 60} distance={24} once>
                <div 
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="card-modern group overflow-hidden border p-0 transition-all duration-300 rounded-2xl"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: isHovered ? '#6C4CFF' : 'var(--border-subtle)',
                    boxShadow: isHovered ? 'var(--shadow-lift)' : 'var(--shadow-card)',
                  }}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                    
                    {/* Image Showcase */}
                    <div 
                      className={`lg:col-span-5 relative overflow-hidden bg-neutral-950 min-h-[280px] sm:min-h-[340px] ${isEven ? '' : 'lg:order-last'}`}
                    >
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                      
                      {/* Metric Tag overlaid on image */}
                      <div className="absolute top-4 left-4">
                        <span className="px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-[#080A12]/90 backdrop-blur-md text-[#B8F36B] border border-white/15 shadow-lg">
                          {p.outcome}
                        </span>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                      <div>
                        {/* Header: Category & Index */}
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <span className="tag-violet">
                            {p.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-neutral-400">
                            0{idx + 1}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
                          <Link to={`/projects/${p.slug}`} className="hover:text-[#6C4CFF] transition-colors">
                            {p.title}
                          </Link>
                        </h3>

                        {/* Description */}
                        <p className="body-md mb-6" style={{ color: 'var(--text-secondary)' }}>
                          {p.fullDescription || p.description}
                        </p>

                        {/* Key Outcomes */}
                        {p.results && p.results.length > 0 && (
                          <div className="p-4 rounded-xl mb-6 bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                              Key Outcomes
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {p.results.map((r, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white dark:bg-black/40 border border-black/5 dark:border-white/10 text-neutral-800 dark:text-neutral-200">
                                  ✓ {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer: Tech Stack + Detail Link */}
                      <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.techStack.map(tag => (
                            <span 
                              key={tag} 
                              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-600 dark:text-neutral-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <Link
                          to={`/projects/${p.slug}`}
                          className="inline-flex items-center gap-2 text-sm font-bold text-[#6C4CFF] hover:text-[#FF5A5F] transition-colors group-hover:translate-x-1 duration-200"
                        >
                          Read Case Study <ArrowRight size={15} />
                        </Link>
                      </div>

                    </div>

                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Bottom Banner */}
        {limit && (
          <div className="mt-12 text-center">
            <Link to="/projects" className="btn-primary">
              Explore All Case Studies <ArrowRight size={16} />
            </Link>
          </div>
        )}

      </div>
    </section>
  );
};

export default ProjectsGrid;
