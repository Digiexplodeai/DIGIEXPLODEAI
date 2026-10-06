import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import ScrollReveal from '../UI/ScrollReveal';

const steps = [
  { 
    num: '01', 
    title: 'Discover & Audit', 
    desc: 'Deep brand consultation, funnel audit, unit economics review, customer avatar mapping, and growth bottleneck identification.',
    deliverables: ['Unit Economics Analysis', 'Ad Account Health Check', 'Competitor Landscape', 'Growth Bottleneck Report']
  },
  { 
    num: '02', 
    title: 'Strategy & Roadmap', 
    desc: 'Comprehensive campaign architecture, audience segmentation matrix, message testing roadmap, and multi-channel budget phasing.',
    deliverables: ['Full-Funnel Media Architecture', 'Budget Allocation Plan', 'Audience Archetype Targeting', 'KPI & Attribution Framework']
  },
  { 
    num: '03', 
    title: 'Creative Production', 
    desc: 'Direct-response ad visuals, high-retention video hooks, interactive carousel designs, and copy angles engineered to stop the scroll.',
    deliverables: ['Viral Video Hooks & Scripts', 'Direct-Response Ad Sets', 'High-Converting Landing Pages', 'Dynamic Copy Variations']
  },
  { 
    num: '04', 
    title: 'Execute & Launch', 
    desc: 'Targeted campaign launch, multi-touch pixel setup, real-time bid adjustments, and rapid creative A/B testing in live traffic.',
    deliverables: ['Conversion API Tracking', 'Daily Budget Optimization', 'Audience Signal Testing', 'Rapid Creative Swapping']
  },
  { 
    num: '05', 
    title: 'Scale & Compound', 
    desc: 'Horizontal audience expansion, retargeting funnels, automated lifetime value triggers, and persistent ROAS compounding.',
    deliverables: ['Budget Multiplier Scaling', 'High-Intent Lookalikes', 'Retention & Email Workflows', 'Weekly Executive Dashboards']
  },
];

const Process: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section 
      id="process"
      className="relative overflow-hidden transition-colors"
      style={{ 
        background: 'var(--bg-cool)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      {/* Ambient background glow */}
      <div 
        className="absolute top-1/3 left-1/3 w-[600px] h-[350px] rounded-full pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, #2563FF 0%, #6C4CFF 50%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      <div className="editorial-container relative z-10">

        {/* Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#2563FF]/10 text-[#2563FF] dark:text-[#3B82FF] border border-[#2563FF]/20">
                <Sparkles size={13} className="text-[#6C4CFF]" />
                <span>Our 5-Stage Method</span>
              </div>
              <h2 className="display-lg m-0" style={{ color: 'var(--text-primary)' }}>
                A process engineered for <br />
                <span className="text-gradient-primary">speed & precision.</span>
              </h2>
            </div>
            <p className="text-sm sm:text-base max-w-md leading-relaxed m-0" style={{ color: 'var(--text-secondary)' }}>
              No guesswork or bloated timelines. Every project follows an agile 5-stage sprint to reach positive ROI fast.
            </p>
          </div>
        </ScrollReveal>

        {/* Connected Horizontal Journey Line */}
        <div className="relative mb-10">
          <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full w-full relative overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${((activeStep + 1) / steps.length) * 100}%`,
                background: 'linear-gradient(90deg, #6C4CFF, #2563FF, #B8F36B)',
              }}
            />
          </div>
        </div>

        {/* 5-Column Interactive Journey Steps for Desktop */}
        <div className="hidden lg:grid grid-cols-5 gap-4 mb-8">
          {steps.map((step, idx) => {
            const isActive = activeStep === idx;

            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(idx)}
                type="button"
                className="text-left p-5 rounded-2xl transition-all duration-300 border flex flex-col justify-between cursor-pointer group"
                style={{
                  background: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  borderColor: isActive ? '#6C4CFF' : 'var(--border-subtle)',
                  boxShadow: isActive ? '0 10px 30px rgba(108, 76, 255, 0.18)' : 'none',
                }}
              >
                <div>
                  <span 
                    className="text-3xl font-extrabold font-mono block mb-3 transition-colors"
                    style={{ color: isActive ? '#6C4CFF' : 'var(--text-muted)' }}
                  >
                    {step.num}
                  </span>
                  <h3 className="font-extrabold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                    {step.title}
                  </h3>
                </div>

                <span 
                  className="text-xs font-bold transition-colors flex items-center gap-1 mt-4"
                  style={{ color: isActive ? '#2563FF' : 'var(--text-muted)' }}
                >
                  {isActive ? 'Active Stage' : 'Select Stage'} →
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Detailed Panel */}
        <div 
          className="p-6 sm:p-10 rounded-3xl border transition-all duration-300"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left: Step Description */}
            <div className="md:col-span-7">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-0.5 rounded text-xs font-extrabold font-mono bg-[#6C4CFF] text-white">
                  STAGE {steps[activeStep].num}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Phase Duration: 1-2 Weeks
                </span>
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-extrabold mb-4" style={{ color: 'var(--text-primary)' }}>
                {steps[activeStep].title}
              </h3>

              <p className="text-base sm:text-lg leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                {steps[activeStep].desc}
              </p>
            </div>

            {/* Right: Deliverables List */}
            <div className="md:col-span-5 p-5 sm:p-6 rounded-2xl border bg-black/[0.02] dark:bg-white/[0.04]" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-xs font-bold uppercase tracking-wider text-[#2563FF] dark:text-[#3B82FF] block mb-3">
                Phase Deliverables
              </span>
              <div className="flex flex-col gap-2.5">
                {steps[activeStep].deliverables.map((d, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={16} className="text-[#6C4CFF] flex-shrink-0" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Mobile Accordion */}
        <div className="lg:hidden mt-6 flex flex-col gap-3">
          {steps.map((step, idx) => (
            <button
              key={step.num}
              onClick={() => setActiveStep(idx)}
              className={`p-4 rounded-xl text-left border flex items-center justify-between transition-colors ${activeStep === idx ? 'bg-[#6C4CFF]/15 border-[#6C4CFF]' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10'}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm text-[#6C4CFF]">{step.num}</span>
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{step.title}</span>
              </div>
              <ArrowRight size={14} className="text-neutral-400" />
            </button>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Process;
