import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Star, Quote, CheckCircle, Sparkles } from 'lucide-react';
import { testimonials } from '../../data/testimonials';
import ScrollReveal from '../UI/ScrollReveal';

const clientMetrics = [
  { metric: '3x Lead Inflow', period: 'First 30 days scale', badge: 'Verified Client' },
  { metric: '4.8x Ad ROAS', period: 'Across Q2 campaigns', badge: 'Verified Client' },
  { metric: '99 Speed Score', period: 'Lighthouse audit', badge: 'Verified Client' },
];

const Testimonials: React.FC = () => {
  const [active, setActive] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const t = testimonials[active] || testimonials[0];
  const m = clientMetrics[active] || clientMetrics[0];

  const changeTestimonial = (nextIdx: number) => {
    if (isFading || nextIdx === active) return;
    setIsFading(true);
    setTimeout(() => {
      setActive(nextIdx);
      setIsFading(false);
    }, 200);
  };

  const handlePrev = () => {
    const prev = (active - 1 + testimonials.length) % testimonials.length;
    changeTestimonial(prev);
  };

  const handleNext = () => {
    const next = (active + 1) % testimonials.length;
    changeTestimonial(next);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, isFading]);

  return (
    <section 
      id="testimonials"
      className="transition-colors overflow-hidden"
      style={{ 
        background: 'var(--bg-secondary)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      <div className="editorial-container">

        {/* Section Header with Arrow Controls */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex items-center justify-between gap-4 mb-10 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-[#6C4CFF]/10 text-[#6C4CFF] dark:text-[#F3F1FF] border border-[#6C4CFF]/20">
                <Sparkles size={13} />
                <span>Client Stories & Impact</span>
              </div>
              <h2 className="display-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Trusted by high-growth founders.
              </h2>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePrev}
                aria-label="Previous testimonial"
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                aria-label="Next testimonial"
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Testimonial Showcase Card */}
        <div 
          className="card-modern rounded-3xl border p-8 sm:p-12 relative overflow-hidden transition-all duration-300"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-lift)',
          }}
        >
          {/* Top Row: Stars + Result Tag */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={17} className="fill-[#FF5A5F] text-[#FF5A5F]" />
              ))}
              <span className="text-xs font-extrabold ml-2" style={{ color: 'var(--text-muted)' }}>
                5.0 Rating
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#6C4CFF]/10 text-[#6C4CFF] dark:text-[#F3F1FF] border border-[#6C4CFF]/20">
              <CheckCircle size={13} />
              <span>{m.metric} · {m.period}</span>
            </div>
          </div>

          {/* Quote icon */}
          <Quote size={40} className="text-[#6C4CFF]/20 mb-4" />

          {/* Testimonial Text */}
          <blockquote
            className="text-xl sm:text-2xl md:text-3xl font-extrabold leading-snug tracking-tight mb-10 transition-all duration-200"
            style={{
              color: 'var(--text-primary)',
              opacity: isFading ? 0 : 1,
              transform: isFading ? 'translateY(6px)' : 'translateY(0)',
            }}
          >
            "{t.content}"
          </blockquote>

          {/* Attribution Footer */}
          <div 
            className="pt-6 border-t flex flex-wrap items-center justify-between gap-6"
            style={{ 
              borderColor: 'var(--border-subtle)',
              opacity: isFading ? 0 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            <div className="flex items-center gap-4">
              <img
                src={t.avatar}
                alt={t.name}
                className="w-13 h-13 rounded-full object-cover border-2"
                style={{ borderColor: '#6C4CFF' }}
              />
              <div>
                <div className="font-extrabold text-base sm:text-lg" style={{ color: 'var(--text-primary)' }}>
                  {t.name}
                </div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {t.role}, <span className="text-[#6C4CFF]">{t.company}</span>
                </div>
              </div>
            </div>

            {/* Indicator Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => changeTestimonial(i)}
                  aria-label={`Testimonial slide ${i + 1}`}
                  className="h-2 rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    width: i === active ? 28 : 8,
                    background: i === active ? '#6C4CFF' : 'var(--border-strong)',
                  }}
                />
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

export default Testimonials;
