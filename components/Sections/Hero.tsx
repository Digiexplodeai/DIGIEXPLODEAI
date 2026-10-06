import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Users, Target, Zap, Activity, Sparkles, BarChart2, ShieldCheck } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import HeroPerformanceScene from '../3D/HeroPerformanceScene';

/* ── Interactive Sparkline Chart ── */
const Sparkline: React.FC<{ data: number[]; color: string; isVisible: boolean }> = ({ data, color, isVisible }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 135, h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 350,
          strokeDashoffset: isVisible ? 0 : 350,
          transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill={`${color}18`}
        stroke="none"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 1s ease 0.3s',
        }}
      />
    </svg>
  );
};

/* ── KPI Metric Component ── */
const KPICard: React.FC<{
  icon: React.ElementType;
  label: string;
  val: string;
  delta: string;
  col: string;
  isLast?: boolean;
  isVisible: boolean;
}> = ({ icon: Icon, label, val, delta, col, isLast, isVisible }) => {
  const animatedVal = useCountUp(val, isVisible, { duration: 1400 });

  return (
    <div
      style={{
        padding: '14px 12px',
        borderRight: !isLast ? '1px solid rgba(255,255,255,0.08)' : 'none',
        transition: 'background 0.2s ease',
      }}
      className="hover:bg-white/[0.04] transition-colors"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <Icon size={12} color={col} />
        <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.50)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.03em', color: '#FFFFFF', lineHeight: 1.1 }}>
        {animatedVal}
      </div>
      <div style={{ fontSize: '10.5px', fontWeight: 800, color: col, marginTop: '4px' }}>
        {delta}
      </div>
    </div>
  );
};

const Hero: React.FC = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [activeRange, setActiveRange] = useState<'7D' | '14D' | '30D' | '90D'>('14D');
  const [activeChannel, setActiveChannel] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(timer);
  }, []);

  // Subtle 3D tilt on dashboard card for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || window.innerWidth < 1024) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * -3;
    const y = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 3;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Dynamic attribution data based on selected range
  const rangeData = {
    '7D': {
      roas: '4.6x', leads: '1,420', cpl: '₹195', conv: '5.9%',
      leadSpark: [50, 62, 78, 85, 92, 110, 125],
      revSpark: [40, 52, 60, 68, 80, 95, 112],
      metaSpend: '₹22,400', googleSpend: '₹11,800',
    },
    '14D': {
      roas: '4.8x', leads: '3,210', cpl: '₹182', conv: '6.4%',
      leadSpark: [40, 55, 48, 70, 82, 76, 95, 88, 110, 104, 125, 118, 140, 155],
      revSpark: [30, 42, 38, 55, 60, 68, 72, 80, 90, 88, 100, 108, 120, 135],
      metaSpend: '₹48,200', googleSpend: '₹24,100',
    },
    '30D': {
      roas: '5.2x', leads: '7,840', cpl: '₹168', conv: '7.1%',
      leadSpark: [35, 45, 60, 72, 88, 95, 110, 130, 145, 160, 175, 190, 210, 240],
      revSpark: [28, 38, 50, 62, 75, 85, 98, 115, 132, 148, 165, 182, 205, 230],
      metaSpend: '₹104,000', googleSpend: '₹56,500',
    },
    '90D': {
      roas: '5.6x', leads: '24,100', cpl: '₹152', conv: '7.8%',
      leadSpark: [30, 50, 75, 100, 135, 170, 210, 250, 290, 340, 390, 440, 500, 560],
      revSpark: [25, 42, 65, 90, 120, 155, 195, 235, 275, 320, 370, 420, 480, 540],
      metaSpend: '₹312,000', googleSpend: '₹168,000',
    },
  };

  const currentData = rangeData[activeRange];

  return (
    <section
      className="relative overflow-hidden transition-colors"
      style={{
        background: 'var(--bg-page)',
        paddingTop: 'clamp(96px, 10vw, 126px)',
        paddingBottom: 'clamp(64px, 7vw, 96px)',
      }}
    >
      {/* ── Living Performance Intelligence 3D Canvas ── */}
      <HeroPerformanceScene />

      {/* Atmospheric radial glows */}
      <div 
        className="absolute top-1/4 left-1/4 w-[500px] h-[350px] rounded-full pointer-events-none opacity-20 dark:opacity-30"
        style={{
          background: 'radial-gradient(circle, #6C4CFF 0%, #2563FF 40%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <div 
        className="absolute bottom-1/3 right-1/4 w-[400px] h-[300px] rounded-full pointer-events-none opacity-15 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, #FF5A5F 0%, transparent 65%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Noise overlay */}
      <div className="noise-overlay absolute inset-0 z-0 pointer-events-none opacity-20 dark:opacity-30" />

      <div className="editorial-container relative z-10">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
            gap: 'clamp(40px, 5vw, 68px)',
            alignItems: 'center',
          }}
        >
          {/* ── LEFT: Value Proposition Copy ── */}
          <div className="relative z-10">
            {/* Live Availability Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '24px',
                padding: '6px 14px',
                borderRadius: '99px',
                background: 'rgba(108, 76, 255, 0.08)',
                border: '1px solid rgba(108, 76, 255, 0.20)',
                backdropFilter: 'blur(8px)',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(12px)',
                transition: 'all 0.6s var(--ease-out-expo)',
              }}
            >
              <div className="live-pulse-dot w-2 h-2 rounded-full bg-[#B8F36B]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#6C4CFF] dark:text-[#F3F1FF]">
                Open for Q3/Q4 Brand Scale · Growth & Technology
              </span>
            </div>

            {/* Headline */}
            <h1 
              className="display-xl mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              We build brands <br />
              that{' '}
              <span className="text-gradient-primary inline-block">
                perform.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p 
              className="body-lg mb-8 max-w-lg"
              style={{ color: 'var(--text-secondary)' }}
            >
              From direct-response Meta & Google Ads to high-speed web apps and viral creative engines — we engineer creative campaigns with ruthless ROI focus.
            </p>

            {/* CTAs */}
            <div 
              className="flex items-center gap-3.5 flex-wrap mb-10"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(14px)',
                transition: 'all 0.7s var(--ease-out-expo) 0.2s',
              }}
            >
              <Link to="/start-project" className="btn-primary group">
                Start a Project <ArrowRight size={16} className="arrow-right-hover" />
              </Link>
              <Link to="/projects" className="btn-outline group">
                View Our Work
              </Link>
            </div>

            {/* Controlled Capability Pill Labels */}
            <div
              className="pt-6 border-t flex flex-wrap items-center gap-2"
              style={{
                borderColor: 'var(--border-subtle)',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.8s ease 0.4s',
              }}
            >
              <span className="tag-cobalt">Performance Marketing</span>
              <span className="tag-coral">Creative Direction</span>
              <span className="tag-violet">Modern Web Apps</span>
              <span className="tag-lime">SEO Authority</span>
              <span className="tag-aqua">AI Workflows</span>
            </div>
          </div>

          {/* ── RIGHT: Live Campaign Intelligence Center ── */}
          <div
            style={{
              perspective: '1200px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
              transition: 'all 0.85s var(--ease-out-expo) 0.15s',
            }}
          >
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="rounded-2xl border overflow-hidden shadow-2xl relative z-10"
              style={{
                background: 'rgba(15, 18, 32, 0.95)',
                backdropFilter: 'blur(22px)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: tilt.x === 0 ? 'transform 0.5s var(--ease-out-expo), box-shadow 0.3s ease' : 'box-shadow 0.3s ease',
                boxShadow: '0 28px 70px rgba(0, 0, 0, 0.50), 0 0 45px rgba(108, 76, 255, 0.22)',
              }}
            >
              {/* Dashboard Topbar */}
              <div 
                className="px-5 py-3.5 border-b flex items-center justify-between"
                style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {['#FF5A5F', '#FEBC2E', '#B8F36B'].map(c => (
                      <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-white/60 font-mono ml-2">
                    DigiCommand™ // Live Attribution
                  </span>
                </div>

                {/* Range Selector */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                  {(['7D', '14D', '30D', '90D'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setActiveRange(range)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer"
                      style={{
                        background: activeRange === range ? '#6C4CFF' : 'transparent',
                        color: activeRange === range ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 KPIs with count up */}
              <div 
                className="grid grid-cols-4 border-b"
                style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <KPICard icon={TrendingUp} label="Blended ROAS" val={currentData.roas} delta="+0.8x" col="#6C4CFF" isVisible={mounted} />
                <KPICard icon={Users} label="Total Leads" val={currentData.leads} delta="+312%" col="#B8F36B" isVisible={mounted} />
                <KPICard icon={Target} label="Cost / Lead" val={currentData.cpl} delta="-38%" col="#FF5A5F" isVisible={mounted} />
                <KPICard icon={Zap} label="Conversion" val={currentData.conv} delta="+2.2%" col="#39D9C6" isLast isVisible={mounted} />
              </div>

              {/* Trajectory charts */}
              <div 
                className="p-4 sm:p-5 border-b"
                style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                    <Activity size={13} className="text-[#6C4CFF]" /> Growth Trajectory
                  </span>
                  <span className="text-[10px] font-medium text-white/40">
                    Window: {activeRange}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] font-bold text-[#6C4CFF] mb-1">Inbound Leads</div>
                    <Sparkline data={currentData.leadSpark} color="#6C4CFF" isVisible={mounted} />
                  </div>
                  <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] font-bold text-[#B8F36B] mb-1">Attributed Revenue</div>
                    <Sparkline data={currentData.revSpark} color="#B8F36B" isVisible={mounted} />
                  </div>
                </div>
              </div>

              {/* Active Channel breakdown */}
              <div 
                className="p-4 sm:p-5 border-b"
                style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-3 flex items-center justify-between">
                  <span>Channel Performance</span>
                  <span className="text-[10px] text-[#B8F36B] font-bold">ROAS Multiplier</span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {[
                    { name: 'Meta Ads (FB & IG)', spend: currentData.metaSpend, roas: '5.2x', pct: 78, color: '#6C4CFF' },
                    { name: 'Google Ads (Search & PMax)', spend: currentData.googleSpend, roas: '4.4x', pct: 54, color: '#2563FF' },
                    { name: 'SEO & Organic Growth', spend: 'Organic', roas: '∞ ROAS', pct: 68, color: '#B8F36B' },
                  ].map((ch, idx) => (
                    <div
                      key={ch.name}
                      onMouseEnter={() => setActiveChannel(idx)}
                      onMouseLeave={() => setActiveChannel(null)}
                      className="p-2 rounded-lg transition-colors cursor-default"
                      style={{
                        background: activeChannel === idx ? 'rgba(255,255,255,0.06)' : 'transparent',
                      }}
                    >
                      <div className="flex justify-between items-center mb-1.5 text-xs">
                        <span className="font-semibold text-white/80">{ch.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-white/40">{ch.spend}</span>
                          <span className="font-bold text-xs" style={{ color: ch.color }}>{ch.roas}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: mounted ? `${ch.pct}%` : '0%',
                            background: `linear-gradient(90deg, ${ch.color}, #6C4CFF)`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom footer bar */}
              <div className="px-5 py-3 bg-black/25 flex items-center justify-between text-[11px] text-white/45">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[#B8F36B]" />
                  <span>Demonstration dashboard for illustrative scale</span>
                </div>
                <Link to="/start-project" className="text-[#6C4CFF] hover:text-[#B8F36B] font-bold transition-colors">
                  Build Custom Plan →
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
