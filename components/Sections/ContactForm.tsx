import React, { useState, useId } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Sparkles, MessageSquare, Mail, Phone, Clock, AlertCircle } from 'lucide-react';
import { siteConfig } from '../../config/site';
import ScrollReveal from '../UI/ScrollReveal';
import ContactEchoScene from '../3D/ContactEchoScene';

const ContactForm: React.FC = () => {
  const nameId = useId();
  const emailId = useId();
  const serviceId = useId();
  const budgetId = useId();
  const messageId = useId();

  const [formState, setFormState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    service: 'Performance Marketing (Meta / Google)',
    budget: '₹50,000 - ₹2,00,000 / month',
    message: '',
  });

  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; email?: string; message?: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Please enter your name.';
    if (!formData.email.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid work email address.';
    }
    if (!formData.message.trim() || formData.message.length < 10) {
      newErrors.message = 'Please provide a brief description (at least 10 characters).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || formState === 'loading') return;

    setFormState('loading');
    setTimeout(() => {
      setFormState('success');
      setFormData({
        name: '',
        email: '',
        service: 'Performance Marketing (Meta / Google)',
        budget: '₹50,000 - ₹2,00,000 / month',
        message: '',
      });
      setErrors({});
    }, 1200);
  };

  if (formState === 'success') {
    return (
      <section 
        id="contact" 
        className="relative overflow-hidden transition-colors"
        style={{ 
          background: '#080A12', 
          paddingTop: 'var(--section-y)', 
          paddingBottom: 'var(--section-y)',
          color: '#FFFFFF',
        }}
      >
        <div className="editorial-container text-center max-w-xl mx-auto">
          <div className="animate-fade-up bg-white/[0.04] border border-white/10 p-8 sm:p-12 rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-[#B8F36B]/20 border border-[#B8F36B]/40 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={36} className="text-[#B8F36B]" />
            </div>
            
            <h3 className="display-md text-white mb-3">
              Project Brief Received!
            </h3>
            
            <p className="text-white/70 text-base leading-relaxed mb-8">
              Thank you! Our growth strategy team has received your brief and will review your parameters within 2 business hours.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button 
                onClick={() => setFormState('idle')} 
                className="btn-outline-light w-full sm:w-auto justify-center cursor-pointer"
              >
                Submit Another Inquiry
              </button>
              
              <a 
                href={siteConfig.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-coral w-full sm:w-auto justify-center"
              >
                Chat on WhatsApp Now <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="contact"
      className="relative overflow-hidden transition-colors"
      style={{ 
        background: '#080A12', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
        color: '#FFFFFF',
      }}
    >
      {/* 3D Echo Sculpture */}
      <ContactEchoScene className="absolute -left-20 top-1/4 w-96 h-96 opacity-40 hidden md:block" />

      {/* Atmospheric radial background glows */}
      <div 
        className="absolute top-1/3 right-1/4 w-[600px] h-[400px] rounded-full pointer-events-none opacity-25"
        style={{
          background: 'radial-gradient(circle, #6C4CFF 0%, #2563FF 40%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />
      <div 
        className="absolute bottom-1/4 left-1/3 w-[450px] h-[300px] rounded-full pointer-events-none opacity-15"
        style={{
          background: 'radial-gradient(circle, #FF5A5F 0%, transparent 65%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="noise-overlay absolute inset-0 pointer-events-none opacity-30" />

      <div className="editorial-container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          
          {/* Left Column: Value Prop & Direct Contact Channels (5 cols) */}
          <div className="lg:col-span-5 relative z-10">
            <ScrollReveal direction="up" distance={20}>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 bg-white/10 text-[#B8F36B] border border-white/15">
                <Sparkles size={13} />
                <span>Let's Build Something Explosive</span>
              </div>

              <h2 className="display-md text-white mb-4">
                Ready to scale your revenue?
              </h2>

              <p className="text-white/70 text-base leading-relaxed mb-8">
                Share your targets, current unit economics, and upcoming timelines. Our partners personally review each brief to formulate high-impact strategies.
              </p>

              {/* Response Time Indicator */}
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 mb-8 backdrop-blur-sm">
                <div className="live-pulse-dot w-2.5 h-2.5 rounded-full bg-[#B8F36B] flex-shrink-0" />
                <span className="text-xs font-bold text-[#B8F36B] uppercase tracking-wide">
                  Average Strategic Response Time: Under 2 Hours
                </span>
              </div>

              {/* Direct channels */}
              <div className="flex flex-col gap-3.5">
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#6C4CFF] transition-all text-white/90 group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#6C4CFF]/20 flex items-center justify-center text-[#6C4CFF] group-hover:scale-105 transition-transform">
                    <Mail size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 block">Email Us Directly</span>
                    <span className="text-sm font-semibold">{siteConfig.email}</span>
                  </div>
                </a>

                <a
                  href={siteConfig.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#FF5A5F] transition-all text-white/90 group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#FF5A5F]/20 flex items-center justify-center text-[#FF5A5F] group-hover:scale-105 transition-transform">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 block">Instant WhatsApp Chat</span>
                    <span className="text-sm font-semibold">{siteConfig.phone}</span>
                  </div>
                </a>
              </div>
            </ScrollReveal>
          </div>

          {/* Right Column: Interactive Brief Form (7 cols) */}
          <div className="lg:col-span-7 relative z-10">
            <ScrollReveal direction="up" delay={80} distance={20}>
              <form
                onSubmit={handleSubmit}
                noValidate
                className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-6 sm:p-10 flex flex-col gap-5 shadow-2xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label htmlFor={nameId} className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Full Name *
                    </label>
                    <input
                      id={nameId}
                      type="text"
                      required
                      placeholder="e.g. Vikram Singhania"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (errors.name) setErrors({ ...errors, name: undefined });
                      }}
                      className={`input-field-dark ${errors.name ? 'border-red-400 focus:border-red-400' : ''}`}
                    />
                    {errors.name && (
                      <span className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                        <AlertCircle size={12} /> {errors.name}
                      </span>
                    )}
                  </div>

                  {/* Work Email */}
                  <div>
                    <label htmlFor={emailId} className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Work Email *
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      required
                      placeholder="vikram@company.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (errors.email) setErrors({ ...errors, email: undefined });
                      }}
                      className={`input-field-dark ${errors.email ? 'border-red-400 focus:border-red-400' : ''}`}
                    />
                    {errors.email && (
                      <span className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                        <AlertCircle size={12} /> {errors.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Capability */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor={serviceId} className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Primary Service Focus
                    </label>
                    <select
                      id={serviceId}
                      value={formData.service}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      className="input-field-dark bg-[#0F1220] text-white cursor-pointer"
                    >
                      <option>Performance Marketing (Meta / Google)</option>
                      <option>Social Media Marketing & Growth</option>
                      <option>SEO & Search Authority</option>
                      <option>High-Converting Web App / Website</option>
                      <option>Creative & Video Production</option>
                      <option>Full Brand Ecosystem Scaling</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor={budgetId} className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                      Target Monthly Budget
                    </label>
                    <select
                      id={budgetId}
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="input-field-dark bg-[#0F1220] text-white cursor-pointer"
                    >
                      <option>₹50,000 - ₹1,50,000 / month</option>
                      <option>₹1,50,000 - ₹5,00,000 / month</option>
                      <option>₹5,00,000 - ₹15,00,000 / month</option>
                      <option>₹15,00,000+ / month (Enterprise)</option>
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor={messageId} className="block text-xs font-bold uppercase tracking-wider text-white/70 mb-2">
                    Project Goals & Current Challenge *
                  </label>
                  <textarea
                    id={messageId}
                    rows={4}
                    required
                    placeholder="Tell us about your brand, current monthly revenue, targets, and desired timeline..."
                    value={formData.message}
                    onChange={(e) => {
                      setFormData({ ...formData, message: e.target.value });
                      if (errors.message) setErrors({ ...errors, message: undefined });
                    }}
                    className={`input-field-dark resize-none ${errors.message ? 'border-red-400 focus:border-red-400' : ''}`}
                  />
                  {errors.message && (
                    <span className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} /> {errors.message}
                    </span>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={formState === 'loading'}
                  className="btn-primary w-full justify-center text-center py-4 text-base font-extrabold group mt-2 cursor-pointer"
                >
                  {formState === 'loading' ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin" /> Preparing Strategic Review...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Submit Strategic Brief <ArrowRight size={17} className="arrow-right-hover" />
                    </span>
                  )}
                </button>

                <p className="text-[11px] text-center text-white/40">
                  Strict confidentiality guaranteed. We never share or sell your business data.
                </p>
              </form>
            </ScrollReveal>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ContactForm;
