import React, { useState } from 'react';
import { webPricingPlans, androidPricingPlans, bundlePricingPlans } from '../../data/pricing';
import { Check, ArrowUpRight, ArrowRight, Sparkles } from 'lucide-react';
import { siteConfig } from '../../config/site';
import ScrollReveal from '../UI/ScrollReveal';

type Category = 'web' | 'android' | 'bundle';

const Pricing: React.FC = () => {
  const [category, setCategory] = useState<Category>('web');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const plans = category === 'web' ? webPricingPlans : category === 'android' ? androidPricingPlans : bundlePricingPlans;

  const catLabels: { key: Category; label: string }[] = [
    { key: 'web', label: 'Web & Growth' },
    { key: 'android', label: 'Mobile Apps' },
    { key: 'bundle', label: 'Full Ecosystem' },
  ];

  return (
    <section 
      id="pricing"
      className="transition-colors"
      style={{ 
        background: 'var(--bg-surface)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      <div className="editorial-container">

        {/* Section Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-[#6C4CFF]/10 text-[#6C4CFF] dark:text-[#F3F1FF] border border-[#6C4CFF]/20">
                <Sparkles size={13} />
                <span>Transparent Investment Tiers</span>
              </div>
              <h2 className="display-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Investment models built <br />
                <span className="text-gradient-primary">for measurable ROI.</span>
              </h2>
            </div>

            {/* Monthly / Annual billing switch */}
            <div className="flex items-center gap-3 bg-black/[0.03] dark:bg-white/[0.04] p-1.5 rounded-xl border border-black/5 dark:border-white/10 self-start md:self-end">
              <span className="text-xs font-bold px-2" style={{ color: billing === 'monthly' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                Monthly
              </span>
              <button
                onClick={() => setBilling(b => b === 'monthly' ? 'annual' : 'monthly')}
                aria-label="Toggle annual discount"
                className="w-12 h-6 rounded-full relative transition-colors cursor-pointer"
                style={{
                  background: billing === 'annual' ? '#6C4CFF' : 'var(--border-strong)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm"
                  style={{
                    left: billing === 'annual' ? '26px' : '2px',
                  }}
                />
              </button>
              <span className="text-xs font-bold px-2 flex items-center gap-1.5" style={{ color: billing === 'annual' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                Annual <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#B8F36B] text-[#080A12]">-20%</span>
              </span>
            </div>
          </div>
        </ScrollReveal>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl w-fit mb-8 border border-black/5 dark:border-white/5">
          {catLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer"
              style={{
                background: category === key ? '#6C4CFF' : 'transparent',
                color: category === key ? '#FFFFFF' : 'var(--text-muted)',
                boxShadow: category === key ? '0 2px 8px rgba(108, 76, 255, 0.25)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const price = billing === 'monthly' ? plan.monthlyPrice.inr : plan.annualPrice.inr;
            const isFeatured = idx === 1;

            return (
              <ScrollReveal key={plan.id} direction="up" delay={idx * 80} distance={24} className="h-full">
                <div
                  className="card-modern rounded-2xl p-6 sm:p-8 flex flex-col justify-between h-full relative transition-all duration-300"
                  style={{
                    background: isFeatured ? 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)' : 'var(--bg-card)',
                    border: isFeatured ? '2px solid #6C4CFF' : '1px solid var(--border-subtle)',
                    boxShadow: isFeatured ? 'var(--shadow-violet)' : 'var(--shadow-card)',
                  }}
                >
                  {/* Popular badge */}
                  {isFeatured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#6C4CFF] text-white shadow-md">
                      Recommended Plan
                    </div>
                  )}

                  <div>
                    {/* Tier Name */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-extrabold text-xl" style={{ color: 'var(--text-primary)' }}>
                        {plan.name}
                      </h3>
                      <span className="text-xs font-bold text-neutral-400 font-mono">
                        0{idx + 1}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                      <div className="flex items-baseline gap-1">
                        <span className="font-extrabold text-3xl sm:text-4xl font-mono" style={{ color: 'var(--text-primary)' }}>
                          {price}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          / {billing === 'monthly' ? 'month' : 'yr'}
                        </span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                        {plan.description}
                      </p>
                    </div>

                    {/* Features list */}
                    <div className="flex flex-col gap-3 mb-8">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                        Included Deliverables
                      </span>
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm">
                          <Check size={16} className="text-[#6C4CFF] flex-shrink-0 mt-0.5" />
                          <span style={{ color: 'var(--text-secondary)' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div>
                    <a
                      href={siteConfig.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full justify-center text-center text-sm ${isFeatured ? 'btn-primary' : 'btn-outline'}`}
                    >
                      Get Started With {plan.name} <ArrowRight size={15} />
                    </a>
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

export default Pricing;
