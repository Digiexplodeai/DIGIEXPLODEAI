import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, 
  Target, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  TrendingUp, 
  Share2, 
  Search, 
  Monitor, 
  Palette, 
  HelpCircle,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import SEOHead from '../components/SEO/SEOHead';
import { siteConfig } from '../config/site';

const serviceOptions = [
  { id: 'meta-google-ads', label: 'Performance Ads (Meta / Google)', icon: TrendingUp, desc: 'High ROAS ad sets & bidding optimization' },
  { id: 'social-media', label: 'Social Media & Viral Content Engine', icon: Share2, desc: 'Reels, organic growth & management' },
  { id: 'seo-growth', label: 'SEO & Search Authority', icon: Search, desc: 'Top rankings & compounding organic traffic' },
  { id: 'web-development', label: 'High-Converting Website / Web App', icon: Monitor, desc: 'Fast Next.js / React build & CRO' },
  { id: 'creative-production', label: 'Creative & Video Ad Production', icon: Palette, desc: 'Direct-response hooks & scroll-stoppers' },
  { id: 'brand-strategy', label: 'Complete Brand Positioning Kit', icon: Rocket, desc: 'Identity, messaging & market dominance' },
];

const budgetRanges = [
  { id: 'tier-1', label: '₹50,000 – ₹1,50,000 / month', sub: 'Starter Growth Campaign' },
  { id: 'tier-2', label: '₹1,50,000 – ₹5,00,000 / month', sub: 'Scale & Acquisition Sprint' },
  { id: 'tier-3', label: '₹5,00,000 – ₹15,00,000 / month', sub: 'Aggressive Market Dominance' },
  { id: 'tier-4', label: '₹15,00,000+ / month', sub: 'Enterprise Multi-Channel Scaling' },
];

const primaryGoals = [
  { id: 'lead-generation', label: 'Drive High-Intent Inbound Leads' },
  { id: 'ecommerce-sales', label: 'Scale E-Commerce Purchases & ROAS' },
  { id: 'brand-awareness', label: 'Build Authority & Viral Social Reach' },
  { id: 'digital-product', label: 'Launch New Website / SaaS Application' },
];

const StartProject: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'E-Commerce / D2C Brand',
    websiteUrl: '',
    selectedServices: ['meta-google-ads'] as string[],
    goal: 'lead-generation',
    timeline: 'Immediate (Next 1-2 Weeks)',
    budgetRange: 'tier-2',
    name: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [stepError, setStepError] = useState('');

  // Validate step before advancing
  const handleNext = () => {
    setStepError('');
    if (step === 1) {
      if (!formData.businessName.trim()) {
        setStepError('Please enter your business or company name.');
        return;
      }
    } else if (step === 2) {
      if (formData.selectedServices.length === 0) {
        setStepError('Please select at least one required service.');
        return;
      }
    } else if (step === 4) {
      if (!formData.name.trim() || !formData.email.trim()) {
        setStepError('Please enter your contact name and work email.');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
        setStepError('Please enter a valid work email address.');
        return;
      }
    }
    setStep(s => s + 1);
  };

  const handlePrev = () => {
    setStepError('');
    setStep(s => Math.max(1, s - 1));
  };

  const toggleService = (id: string) => {
    setFormData(prev => {
      const exists = prev.selectedServices.includes(id);
      if (exists) {
        return { ...prev, selectedServices: prev.selectedServices.filter(s => s !== id) };
      } else {
        return { ...prev, selectedServices: [...prev.selectedServices, id] };
      }
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1400));
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  if (isSuccess) {
    const selectedLabels = formData.selectedServices
      .map(id => serviceOptions.find(s => s.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    const whatsappSummary = `Hi DigiexplodeAI, I submitted a project inquiry on your website:%0A- Business: ${encodeURIComponent(formData.businessName)} (${encodeURIComponent(formData.businessType)})%0A- Services: ${encodeURIComponent(selectedLabels)}%0A- Budget: ${encodeURIComponent(budgetRanges.find(b => b.id === formData.budgetRange)?.label || '')}%0A- Contact: ${encodeURIComponent(formData.name)} (${encodeURIComponent(formData.phone || formData.email)})`;

    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--midnight-navy)' }}
      >
        <div className="text-center max-w-lg mx-auto bg-white/[0.04] border border-white/15 p-8 sm:p-12 rounded-3xl animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-[#B8F36B]/20 border border-[#B8F36B]/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={38} className="text-[#B8F36B]" />
          </div>
          
          <h2 className="display-md text-white mb-3">
            Strategy Session Requested!
          </h2>
          
          <p className="text-white/70 text-base leading-relaxed mb-8">
            Thank you, <strong className="text-white">{formData.name}</strong>. We've compiled your brief for <strong className="text-white">{formData.businessName}</strong>. Our senior growth partner will review your goals and reach out within 2 hours.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href={`https://wa.me/918725072730?text=${whatsappSummary}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-coral w-full justify-center text-center"
            >
              <MessageSquare size={16} /> Fast-Track on WhatsApp Now
            </a>

            <button
              onClick={() => navigate('/')}
              className="btn-outline-light w-full justify-center"
            >
              Back to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen transition-colors"
      style={{
        background: 'var(--bg-page)',
        paddingTop: '110px',
        paddingBottom: '80px',
      }}
    >
      <SEOHead
        title="Start Your Project | Interactive Campaign & Growth Wizard — DigiexplodeAI"
        description="Configure your business goals, target deliverables, and growth budget in our interactive multi-step project planner."
        canonicalUrl="https://digiexplode.ai/start-project"
      />

      <div className="editorial-container">
        <div className="max-w-2xl mx-auto">
          
          {/* Progress Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-[#5546F5]/10 text-[#5546F5] border border-[#5546F5]/20">
              <Sparkles size={13} />
              <span>Project Blueprint Wizard</span>
            </div>
            <h1 className="display-md tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
              Let's plan your growth roadmap.
            </h1>
            <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
              Step {step} of 5 · Complete in less than 2 minutes
            </p>

            {/* Stepper bar */}
            <div className="flex items-center justify-between mt-6 gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex-1">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      background: step >= s ? 'var(--electric-violet)' : 'var(--border-strong)',
                    }}
                  />
                  <span className="text-[10px] font-bold uppercase tracking-wider block mt-1.5 text-neutral-400">
                    {s === 1 ? 'Business' : s === 2 ? 'Services' : s === 3 ? 'Goals' : s === 4 ? 'Contact' : 'Review'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Card */}
          <div 
            className="card-modern rounded-3xl border p-6 sm:p-10 shadow-xl transition-all"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Step Error Banner */}
            {stepError && (
              <div className="p-3.5 rounded-xl mb-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{stepError}</span>
              </div>
            )}

            {/* STEP 1: Business Identity */}
            {step === 1 && (
              <div className="animate-fade-up">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Tell us about your brand
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  What company or venture are we scaling together?
                </p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Business / Brand Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Retail or FitPulse Labs"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="input-modern"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Business Category / Model
                    </label>
                    <select
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                      className="input-modern cursor-pointer"
                    >
                      <option>E-Commerce / D2C Brand</option>
                      <option>B2B SaaS / Tech Startup</option>
                      <option>High-Ticket Coaching / Consulting</option>
                      <option>Local Services / Clinic / Real Estate</option>
                      <option>Mobile App / Digital Platform</option>
                      <option>Other / Custom Venture</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Current Website or Social Handle (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. www.yourbrand.com or @yourbrand"
                      value={formData.websiteUrl}
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                      className="input-modern"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Required Services */}
            {step === 2 && (
              <div className="animate-fade-up">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Which capabilities do you need?
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  Select all services relevant to your campaign goals.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {serviceOptions.map((s) => {
                    const isSelected = formData.selectedServices.includes(s.id);
                    const Icon = s.icon;

                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className="p-4 rounded-xl text-left border transition-all flex items-start gap-3 cursor-pointer"
                        style={{
                          background: isSelected ? 'var(--bg-accent-soft)' : 'var(--bg-surface)',
                          borderColor: isSelected ? 'var(--electric-violet)' : 'var(--border-subtle)',
                          boxShadow: isSelected ? '0 4px 12px rgba(85, 70, 245, 0.15)' : 'none',
                        }}
                      >
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: isSelected ? 'var(--electric-violet)' : 'rgba(0,0,0,0.05)',
                            color: isSelected ? '#FFFFFF' : 'var(--text-primary)',
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                            {s.label}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {s.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Goals & Timeline */}
            {step === 3 && (
              <div className="animate-fade-up">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Primary Objective & Budget
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  Define your core priority and investment tier.
                </p>

                {/* Primary Goal */}
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                    Core Growth Priority
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {primaryGoals.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, goal: g.id })}
                        className="p-3.5 rounded-xl text-left border transition-all text-xs sm:text-sm font-semibold cursor-pointer"
                        style={{
                          background: formData.goal === g.id ? 'var(--bg-accent-soft)' : 'var(--bg-surface)',
                          borderColor: formData.goal === g.id ? 'var(--electric-violet)' : 'var(--border-subtle)',
                          color: formData.goal === g.id ? 'var(--electric-violet)' : 'var(--text-primary)',
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget Range */}
                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-muted)' }}>
                    Estimated Monthly Ad / Service Budget
                  </label>
                  <div className="flex flex-col gap-2">
                    {budgetRanges.map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, budgetRange: b.id })}
                        className="p-3.5 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer"
                        style={{
                          background: formData.budgetRange === b.id ? 'var(--bg-accent-soft)' : 'var(--bg-surface)',
                          borderColor: formData.budgetRange === b.id ? 'var(--electric-violet)' : 'var(--border-subtle)',
                        }}
                      >
                        <span className="font-bold text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                          {b.label}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {b.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Target Launch Window
                  </label>
                  <select
                    value={formData.timeline}
                    onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                    className="input-modern cursor-pointer"
                  >
                    <option>Immediate (Next 1-2 Weeks)</option>
                    <option>Within 1 Month</option>
                    <option>Next Quarter (Strategic Planning)</option>
                    <option>Flexible / Exploring Options</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 4: Contact Information */}
            {step === 4 && (
              <div className="animate-fade-up">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Where should we send your strategic roadmap?
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  We'll prepare a custom teardown for your brand.
                </p>

                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Singhania"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-modern"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Work Email *
                    </label>
                    <input
                      type="email"
                      placeholder="vikram@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-modern"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Phone / WhatsApp (For Rapid Consult)
                    </label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input-modern"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                      Additional Context / Notes (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Mention any specific challenges, current monthly spend, or target metrics..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="input-modern resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Final Review & Confirmation */}
            {step === 5 && (
              <div className="animate-fade-up">
                <h2 className="text-xl sm:text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Review your project specifications
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  Please verify your information before dispatching to our strategy team.
                </p>

                <div className="bg-black/[0.03] dark:bg-white/[0.03] p-5 sm:p-6 rounded-2xl border border-black/5 dark:border-white/10 flex flex-col gap-4 mb-6 text-sm">
                  <div className="flex justify-between border-b pb-3 border-black/5 dark:border-white/5">
                    <span className="text-neutral-500 font-semibold">Business:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">{formData.businessName} ({formData.businessType})</span>
                  </div>

                  <div className="flex justify-between border-b pb-3 border-black/5 dark:border-white/5">
                    <span className="text-neutral-500 font-semibold">Selected Services:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 text-right max-w-xs">
                      {formData.selectedServices.map(id => serviceOptions.find(s => s.id === id)?.label).join(', ')}
                    </span>
                  </div>

                  <div className="flex justify-between border-b pb-3 border-black/5 dark:border-white/5">
                    <span className="text-neutral-500 font-semibold">Budget Tier:</span>
                    <span className="font-bold text-[#FF784F]">{budgetRanges.find(b => b.id === formData.budgetRange)?.label}</span>
                  </div>

                  <div className="flex justify-between border-b pb-3 border-black/5 dark:border-white/5">
                    <span className="text-neutral-500 font-semibold">Timeline:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">{formData.timeline}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-neutral-500 font-semibold">Contact:</span>
                    <span className="font-bold text-neutral-800 dark:text-neutral-200">{formData.name} · {formData.email}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 pt-6 border-t flex items-center justify-between gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="btn-outline flex items-center gap-2"
                >
                  <ArrowLeft size={15} /> Back
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary flex items-center gap-2"
                >
                  Next Step <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-coral flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Dispatching Brief...</>
                  ) : (
                    <>Submit Strategic Blueprint <ArrowRight size={16} /></>
                  )}
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default StartProject;
