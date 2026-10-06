import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, TrendingUp, ShieldCheck, Zap, Sparkles, Activity } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import ScrollReveal from '../UI/ScrollReveal';

const statsData = [
  { val: '4.8x', label: 'Average ROAS', desc: 'Across Meta & Google direct-response performance campaigns', col: '#6C4CFF' },
  { val: '+312%', label: 'Lead Growth', desc: 'Average qualified inbound volume increase within 90 days', col: '#B8F36B' },
  { val: '-42%', label: 'Lower CPL', desc: 'Cost-per-lead reduction via funnel & creative optimization', col: '#FF5A5F' },
  { val: '10M+', label: 'Reach Delivered', desc: 'High-intent monthly targeted impressions across client campaigns', col: '#39D9C6' },
];

const StatBlock: React.FC<{
  val: string;
  label: string;
  desc: string;
  col: string;
  index: number;
  isVisible: boolean;
}> = ({ val, label, desc, col, index, isVisible }) => {
  const animatedVal = useCountUp(val, isVisible, { duration: 1800 });

  return (
    <div
      className="p-6 sm:p-8 flex flex-col justify-between relative transition-colors duration-200 hover:bg-white/[0.03]"
      style={{
        borderLeft: index > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ background: col }} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
            {label}
          </span>
        </div>
        
        <div
          className="font-extrabold text-4xl sm:text-5xl tracking-tight leading-none mb-3 font-mono"
          style={{ color: col === '#B8F36B' ? '#B8F36B' : '#FFFFFF' }}
        >
          {animatedVal}
        </div>
      </div>
      
      <p className="text-xs sm:text-sm leading-relaxed text-white/60 m-0">
        {desc}
      </p>
    </div>
  );
};

const ResultsSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const graphRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (graphRef.current) observer.observe(graphRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={graphRef}
      className="relative overflow-hidden transition-colors"
      style={{ 
        background: '#080A12', 
        paddingTop: 'var(--section-y)',
        paddingBottom: 'var(--section-y)',
      }}
    >
      <div className="noise-overlay absolute inset-0 pointer-events-none opacity-40" />
      
      {/* Ambient background blur */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[380px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(108, 76, 255, 0.20) 0%, rgba(37, 99, 255, 0.10) 40%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="editorial-container relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-white/10 text-[#B8F36B] border border-white/15">
              <Zap size={13} />
              <span>Attributed Growth Metrics</span>
            </div>
            <h2 className="display-lg text-white m-0">
              Numbers that prove <br />
              <span className="text-gradient-primary">performance.</span>
            </h2>
          </div>
          
          <p className="text-white/65 text-sm sm:text-base max-w-md leading-relaxed m-0">
            Every campaign is architected with disciplined unit economics, verifiable attribution, and persistent ROAS compounding.
          </p>
        </div>

        {/* Dynamic Growth Trajectory Chart Card */}
        <div 
          className="rounded-2xl border p-5 sm:p-8 mb-10 relative overflow-hidden"
          style={{
            background: 'rgba(21, 25, 43, 0.65)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6C4CFF] block mb-1">
                Aggregate Growth Model
              </span>
              <h3 className="font-extrabold text-lg sm:text-xl text-white">
                Attributed Revenue Yield & ROAS Trajectory (Months 1–6)
              </h3>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded-full bg-[#6C4CFF]" />
                <span className="text-white/70">Revenue Yield</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 rounded-full bg-[#B8F36B]" />
                <span className="text-white/70">ROAS Curve</span>
              </div>
            </div>
          </div>

          {/* SVG Animated Chart */}
          <div className="w-full h-44 sm:h-52 relative">
            <svg viewBox="0 0 1000 200" fill="none" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="yieldGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#6C4CFF" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#6C4CFF" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="roasGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#B8F36B" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#B8F36B" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[40, 90, 140, 190].map((y, i) => (
                <line key={i} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              ))}

              {/* Revenue Curve Fill */}
              <path
                d="M 0,170 Q 200,150 400,95 T 800,35 L 1000,12 L 1000,200 L 0,200 Z"
                fill="url(#yieldGrad2)"
                opacity={isVisible ? 1 : 0}
                style={{ transition: 'opacity 1s ease 0.4s' }}
              />

              {/* Revenue Curve Stroke */}
              <path
                d="M 0,170 Q 200,150 400,95 T 800,35 L 1000,12"
                stroke="#6C4CFF"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: 1200,
                  strokeDashoffset: isVisible ? 0 : 1200,
                  transition: 'stroke-dashoffset 1.8s var(--ease-out-expo)',
                }}
              />

              {/* ROAS Curve Stroke */}
              <path
                d="M 0,180 Q 250,160 500,85 T 1000,25"
                stroke="#B8F36B"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: 1200,
                  strokeDashoffset: isVisible ? 0 : 1200,
                  transition: 'stroke-dashoffset 1.8s var(--ease-out-expo) 0.2s',
                }}
              />

              {/* Data points */}
              {isVisible && (
                <>
                  <circle cx="400" cy="95" r="5" fill="#6C4CFF" stroke="#FFFFFF" strokeWidth="2" className="animate-fade-up" />
                  <circle cx="800" cy="35" r="5" fill="#6C4CFF" stroke="#FFFFFF" strokeWidth="2" className="animate-fade-up" />
                  <circle cx="1000" cy="12" r="6" fill="#B8F36B" stroke="#080A12" strokeWidth="2" className="animate-fade-up" />
                </>
              )}
            </svg>
          </div>
        </div>

        {/* 4 Stat Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-b border-white/10 divide-y sm:divide-y-0 divide-white/10">
          {statsData.map((s, i) => (
            <StatBlock
              key={s.label}
              val={s.val}
              label={s.label}
              desc={s.desc}
              col={s.col}
              index={i}
              isVisible={isVisible}
            />
          ))}
        </div>

      </div>
    </section>
  );
};

export default ResultsSection;
