import React, { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ArrowRight, TrendingUp, Sparkles, DollarSign, Target, HelpCircle, RefreshCw } from 'lucide-react';
import ScrollReveal from '../UI/ScrollReveal';

const presetScenarios = [
  { name: 'Starter Pilot', budget: 50000, cpc: 25, convRate: 4.5, aov: 3500 },
  { name: 'Growth Scale', budget: 200000, cpc: 32, convRate: 5.8, aov: 4200 },
  { name: 'Enterprise Dominance', budget: 1000000, cpc: 45, convRate: 6.5, aov: 6500 },
];

const RoiCalculator: React.FC = () => {
  const budgetId = useId();
  const cpcId = useId();
  const convId = useId();
  const aovId = useId();

  const [budget, setBudget] = useState<number>(150000);
  const [cpc, setCpc] = useState<number>(30);
  const [convRate, setConvRate] = useState<number>(5.0);
  const [aov, setAov] = useState<number>(3800);

  // Safe calculation logic
  const safeBudget = Math.max(0, Number(budget) || 0);
  const safeCpc = Math.max(0.1, Number(cpc) || 0.1);
  const safeConvRate = Math.max(0, Math.min(100, Number(convRate) || 0));
  const safeAov = Math.max(0, Number(aov) || 0);

  const estimatedClicks = safeCpc > 0 ? Math.floor(safeBudget / safeCpc) : 0;
  const estimatedConversions = Math.floor(estimatedClicks * (safeConvRate / 100));
  const estimatedRevenue = Math.round(estimatedConversions * safeAov);
  const estimatedRoas = safeBudget > 0 ? (estimatedRevenue / safeBudget).toFixed(2) : '0.00';
  const estimatedNetProfit = estimatedRevenue - safeBudget;

  const applyPreset = (preset: typeof presetScenarios[0]) => {
    setBudget(preset.budget);
    setCpc(preset.cpc);
    setConvRate(preset.convRate);
    setAov(preset.aov);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <section
      id="calculator"
      className="relative overflow-hidden transition-colors"
      style={{
        background: '#080A12',
        paddingTop: 'var(--section-y)',
        paddingBottom: 'var(--section-y)',
        color: '#FFFFFF',
      }}
    >
      {/* Ambient background glows */}
      <div 
        className="absolute top-1/3 left-1/4 w-[600px] h-[350px] rounded-full pointer-events-none opacity-20"
        style={{
          background: 'radial-gradient(circle, #6C4CFF 0%, #2563FF 50%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <div className="noise-overlay absolute inset-0 pointer-events-none opacity-30" />

      <div className="editorial-container relative z-10">
        
        {/* Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/10 text-[#B8F36B] border border-white/15">
              <Calculator size={14} />
              <span>Interactive ROI & ROAS Forecaster</span>
            </div>
            <h2 className="display-lg text-white mb-4">
              Forecast your campaign return.
            </h2>
            <p className="text-white/65 text-base leading-relaxed">
              Model your prospective ad spend, lead volume, and gross revenue with our real-time performance economics calculator.
            </p>
          </div>
        </ScrollReveal>

        {/* Quick Presets */}
        <div className="flex items-center justify-center gap-2.5 flex-wrap mb-10">
          <span className="text-xs text-white/50 font-bold uppercase tracking-wider mr-1">
            Quick Scenarios:
          </span>
          {presetScenarios.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border bg-white/5 hover:bg-white/15 text-white/90 border-white/10 hover:border-[#6C4CFF] cursor-pointer"
            >
              {preset.name} ({formatCurrency(preset.budget)})
            </button>
          ))}
        </div>

        {/* Calculator Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-5xl mx-auto">
          
          {/* Inputs Column (7 cols) */}
          <div 
            className="lg:col-span-7 rounded-2xl p-6 sm:p-8 flex flex-col justify-between border"
            style={{
              background: 'rgba(21, 25, 43, 0.60)',
              borderColor: 'rgba(255, 255, 255, 0.09)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div>
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Target size={18} className="text-[#6C4CFF]" /> Campaign Parameters
              </h3>

              <div className="flex flex-col gap-6">
                {/* Monthly Budget */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor={budgetId} className="text-xs font-bold uppercase tracking-wider text-white/70">
                      Monthly Ad Budget (INR)
                    </label>
                    <span className="text-sm font-extrabold text-[#B8F36B] font-mono">
                      {formatCurrency(safeBudget)}
                    </span>
                  </div>
                  <input
                    id={budgetId}
                    type="range"
                    min="10000"
                    max="3000000"
                    step="10000"
                    value={safeBudget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full accent-[#6C4CFF] cursor-pointer h-2 bg-white/10 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-white/40 mt-1 font-mono">
                    <span>₹10K</span>
                    <span>₹15L</span>
                    <span>₹30L+</span>
                  </div>
                </div>

                {/* CPC & Conversion Rate Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* CPC */}
                  <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                    <label htmlFor={cpcId} className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                      Avg. Cost Per Click (₹)
                    </label>
                    <input
                      id={cpcId}
                      type="number"
                      min="1"
                      max="1000"
                      value={cpc}
                      onChange={(e) => setCpc(Number(e.target.value))}
                      className="input-field-dark py-2 text-sm font-mono font-bold"
                    />
                    <span className="text-[10px] text-white/40 block mt-1">
                      Meta avg: ₹15-45 | Google: ₹30-90
                    </span>
                  </div>

                  {/* Conversion Rate */}
                  <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                    <label htmlFor={convId} className="text-[11px] font-bold uppercase tracking-wider text-white/60 block mb-1.5">
                      Landing Page Conv. Rate (%)
                    </label>
                    <input
                      id={convId}
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={convRate}
                      onChange={(e) => setConvRate(Number(e.target.value))}
                      className="input-field-dark py-2 text-sm font-mono font-bold"
                    />
                    <span className="text-[10px] text-white/40 block mt-1">
                      Optimized target: 4.5% - 8.0%
                    </span>
                  </div>
                </div>

                {/* Average Order Value / Lead Value */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label htmlFor={aovId} className="text-xs font-bold uppercase tracking-wider text-white/70">
                      Average Order Value / Customer LTV (₹)
                    </label>
                    <span className="text-sm font-extrabold text-[#FF5A5F] font-mono">
                      {formatCurrency(safeAov)}
                    </span>
                  </div>
                  <input
                    id={aovId}
                    type="range"
                    min="500"
                    max="50000"
                    step="500"
                    value={safeAov}
                    onChange={(e) => setAov(Number(e.target.value))}
                    className="w-full accent-[#FF5A5F] cursor-pointer h-2 bg-white/10 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-white/40 mt-1 font-mono">
                    <span>₹500</span>
                    <span>₹25,000</span>
                    <span>₹50,000+</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Assumptions disclaimer */}
            <div className="mt-8 pt-4 border-t border-white/10 text-[11px] text-white/45 leading-normal flex items-start gap-2">
              <HelpCircle size={14} className="flex-shrink-0 mt-0.5 text-white/40" />
              <span>
                Calculations are illustrative estimates based on standard multi-touch performance attribution. Actual outcomes vary with market conditions, offer strength, and creative quality.
              </span>
            </div>
          </div>

          {/* Results Summary Box (5 cols) */}
          <div 
            className="lg:col-span-5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #181D38 0%, #0F1220 100%)',
              border: '1.5px solid rgba(108, 76, 255, 0.35)',
              boxShadow: '0 20px 50px rgba(108, 76, 255, 0.18)',
            }}
          >
            {/* Top Stat: Estimated ROAS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Projected Return On Ad Spend
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#B8F36B]/20 text-[#B8F36B] border border-[#B8F36B]/30">
                  {Number(estimatedRoas) >= 4 ? 'High Yield' : 'Moderate'}
                </span>
              </div>

              <div className="font-extrabold text-5xl sm:text-6xl tracking-tight text-white font-mono mb-6">
                {estimatedRoas}<span className="text-[#6C4CFF] text-3xl sm:text-4xl">x</span>
              </div>

              {/* Breakdown metrics list */}
              <div className="flex flex-col gap-3 py-4 border-y border-white/10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/65">Est. Traffic Clicks:</span>
                  <span className="font-bold font-mono text-white">{estimatedClicks.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/65">Est. Conversions/Leads:</span>
                  <span className="font-bold font-mono text-[#B8F36B]">{estimatedConversions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/65">Gross Projected Revenue:</span>
                  <span className="font-extrabold font-mono text-[#FF5A5F]">{formatCurrency(estimatedRevenue)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/65">Estimated Net Growth Yield:</span>
                  <span className={`font-extrabold font-mono ${estimatedNetProfit >= 0 ? 'text-[#B8F36B]' : 'text-red-400'}`}>
                    {formatCurrency(estimatedNetProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA to start project */}
            <div className="mt-8">
              <Link
                to="/start-project"
                className="btn-coral w-full justify-center text-center group text-sm"
              >
                Scale This Campaign With Us <ArrowRight size={15} className="arrow-right-hover" />
              </Link>
              <span className="text-[10px] text-center text-white/40 block mt-2.5">
                No external data transmitted · Confidential planning
              </span>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

export default RoiCalculator;
