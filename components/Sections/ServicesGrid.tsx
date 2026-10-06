import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Check, ChevronDown, Sparkles, TrendingUp, Share2, Search, Video, Monitor, Compass, Cpu } from 'lucide-react';
import { servicesData } from '../../data/services';
import ScrollReveal from '../UI/ScrollReveal';

const iconMap: Record<string, React.ElementType> = {
  TrendingUp,
  Share2,
  Search,
  Video,
  Monitor,
  Compass,
  Cpu,
};

const categoryLabels: { key: string; label: string }[] = [
  { key: 'All', label: 'All Capabilities' },
  { key: 'Performance', label: 'Performance Ads' },
  { key: 'Social', label: 'Social & Viral' },
  { key: 'SEO', label: 'SEO & Organic' },
  { key: 'Creative', label: 'Creative & Video' },
  { key: 'Web', label: 'Web & Tech' },
  { key: 'Brand', label: 'Brand Strategy' },
];

// Accent color mapping for capabilities
const getCategoryAccent = (category: string) => {
  switch (category) {
    case 'Performance':
      return { color: '#2563FF', bgLight: 'rgba(37, 99, 255, 0.10)', border: 'rgba(37, 99, 255, 0.25)', tagClass: 'tag-cobalt' };
    case 'Creative':
    case 'Social':
      return { color: '#FF5A5F', bgLight: 'rgba(255, 90, 95, 0.10)', border: 'rgba(255, 90, 95, 0.25)', tagClass: 'tag-coral' };
    case 'Web':
      return { color: '#6C4CFF', bgLight: 'rgba(108, 76, 255, 0.10)', border: 'rgba(108, 76, 255, 0.25)', tagClass: 'tag-violet' };
    case 'SEO':
    case 'Brand':
      return { color: '#B8F36B', bgLight: 'rgba(184, 241, 90, 0.15)', border: 'rgba(184, 241, 90, 0.35)', tagClass: 'tag-lime' };
    default:
      return { color: '#39D9C6', bgLight: 'rgba(57, 217, 198, 0.12)', border: 'rgba(57, 217, 198, 0.30)', tagClass: 'tag-aqua' };
  }
};

const ServicesGrid: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const filteredServices = selectedCategory === 'All'
    ? servicesData
    : servicesData.filter(s => s.category === selectedCategory);

  const toggleExpand = (id: string | number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section 
      id="services" 
      className="relative overflow-hidden transition-colors"
      style={{ 
        background: 'var(--bg-secondary)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      {/* Background radial accent glow */}
      <div
        className="absolute top-1/4 right-1/4 w-[600px] h-[400px] rounded-full pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, #6C4CFF 0%, #2563FF 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="editorial-container relative z-10">
        
        {/* Section Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#6C4CFF]/10 text-[#6C4CFF] dark:text-[#F3F1FF] border border-[#6C4CFF]/20">
                <Sparkles size={13} />
                <span>Our Core Capabilities</span>
              </div>
              <h2 className="display-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Capabilities engineered for <br />
                <span className="text-gradient-primary">measurable impact.</span>
              </h2>
            </div>
            
            <Link to="/start-project" className="btn-primary group self-start md:self-end">
              Start a Project <ArrowRight size={15} className="arrow-right-hover" />
            </Link>
          </div>
        </ScrollReveal>

        {/* Minimal Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 scrollbar-none">
          {categoryLabels.map(({ key, label }) => {
            const isSelected = selectedCategory === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border"
                style={{
                  background: isSelected ? '#6C4CFF' : 'var(--bg-card)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                  borderColor: isSelected ? '#6C4CFF' : 'var(--border-subtle)',
                  boxShadow: isSelected ? '0 4px 14px rgba(108, 76, 255, 0.25)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, index) => {
            const Icon = iconMap[service.icon] || Sparkles;
            const isExpanded = expandedId === service.id;
            const accent = getCategoryAccent(service.category);

            return (
              <ScrollReveal key={service.id} direction="up" delay={index * 70} distance={20} className="h-full">
                <div
                  className="service-card group relative p-6 sm:p-8 rounded-2xl border flex flex-col justify-between h-full transition-all duration-300 shadow-sm hover:shadow-xl"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {/* Top Bar: Number + Category Pill */}
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className="text-xs font-mono font-extrabold tracking-widest px-2.5 py-1 rounded-md"
                        style={{
                          background: accent.bgLight,
                          color: accent.color === '#B8F36B' ? '#2D6E00' : accent.color,
                        }}
                      >
                        {service.num}
                      </span>

                      <div className={accent.tagClass}>
                        {service.theme.badge || service.category}
                      </div>
                    </div>

                    {/* Icon + Title */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          background: accent.bgLight,
                          color: accent.color === '#B8F36B' ? '#2D6E00' : accent.color,
                          border: `1px solid ${accent.border}`,
                        }}
                      >
                        <Icon size={20} />
                      </div>
                      
                      <h3 
                        className="font-extrabold text-xl leading-snug tracking-tight"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {service.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p 
                      className="text-sm leading-relaxed mb-6"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {service.description}
                    </p>
                  </div>

                  {/* Bottom: Benchmark Metric & Deliverables Dropdown */}
                  <div className="pt-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    
                    {/* Key Benchmark Pill */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-xl mb-4 bg-black/[0.02] dark:bg-white/[0.04]"
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Core Benchmark
                      </span>
                      <span 
                        className="text-xs font-extrabold"
                        style={{ color: accent.color === '#B8F36B' ? '#2D6E00' : accent.color }}
                      >
                        {service.metric}
                      </span>
                    </div>

                    {/* Expandable Deliverables */}
                    <button
                      onClick={(e) => toggleExpand(service.id, e)}
                      type="button"
                      className="w-full flex items-center justify-between py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                      style={{
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>{isExpanded ? 'Hide Deliverables' : 'View Deliverables (5)'}</span>
                      <ChevronDown 
                        size={15} 
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      />
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t flex flex-col gap-2 animate-fade-up" style={{ borderColor: 'var(--border-subtle)' }}>
                        {service.deliverables.map((d, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <Check size={13} className="text-[#6C4CFF] flex-shrink-0 mt-0.5" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct CTA */}
                    <Link
                      to="/start-project"
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all border"
                      style={{
                        background: 'rgba(108, 76, 255, 0.06)',
                        color: '#6C4CFF',
                        borderColor: 'rgba(108, 76, 255, 0.20)',
                      }}
                    >
                      Get Started With {service.category} <ArrowUpRight size={14} />
                    </Link>

                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default ServicesGrid;
