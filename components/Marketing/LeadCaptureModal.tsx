import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Sparkles, Phone, Mail, MapPin, User, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck, Target, Laptop, Stethoscope, Video, Zap } from 'lucide-react';
import { createInboundLead } from '../../lib/marketingLeads';
import { logVisitorAction, getDetectedVisitorInfo } from '../../lib/marketingTracker';

const SERVICE_OPTIONS = [
  { id: 'ads', label: 'Meta & Google Ads', icon: Target },
  { id: 'web', label: 'Website / Web App', icon: Laptop },
  { id: 'doctor', label: 'Doctor / Clinic Growth', icon: Stethoscope },
  { id: 'video', label: 'Reels & Video Shoot', icon: Video },
  { id: 'full', label: 'Full Digital Scale', icon: Zap },
];

export const LeadCaptureModal: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [selectedInterest, setSelectedInterest] = useState('Meta & Google Ads');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Do not show on admin/portal routes
  const isPortal = location.pathname.startsWith('/portal') ||
                   location.pathname.startsWith('/admin') ||
                   location.pathname.startsWith('/attendance') ||
                   location.pathname.startsWith('/attendence') ||
                   location.pathname.startsWith('/marketing');

  // Pre-fill location from detected telemetry
  useEffect(() => {
    if (!loc) {
      const info = getDetectedVisitorInfo();
      if (info.city && info.city !== 'India') {
        setLoc(info.city);
      }
    }
  }, [isOpen]);

  // Set default interest based on current page
  useEffect(() => {
    if (location.pathname.includes('doctor')) {
      setSelectedInterest('Doctor / Clinic Growth');
    } else if (location.pathname.includes('project')) {
      setSelectedInterest('Website / Web App');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isPortal) {
      setIsOpen(false);
      return;
    }

    const sessionDismissed = sessionStorage.getItem('digiexplode_lead_modal_dismissed');

    // Intent-driven triggers: Listen for custom event dispatch from buttons across the site
    const handleOpenModal = (e: any) => {
      if (e?.detail?.interest) {
        setSelectedInterest(e.detail.interest);
      }
      setIsOpen(true);
      setIsSubmitted(false);
      logVisitorAction('Lead Capture Modal Opened by User');
    };

    window.addEventListener('open_lead_modal', handleOpenModal);
    window.addEventListener('open_audit_modal', handleOpenModal);

    // Auto-display gently after 8 seconds of engagement for first-time visitors
    let autoOpenTimer: NodeJS.Timeout | null = null;
    if (!sessionDismissed && !hasInteracted) {
      autoOpenTimer = setTimeout(() => {
        setIsOpen(true);
        logVisitorAction('Lead Capture Displayed via Timed Trigger');
      }, 8000);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open_lead_modal', handleOpenModal);
      window.removeEventListener('open_audit_modal', handleOpenModal);
      window.removeEventListener('keydown', handleKeyDown);
      if (autoOpenTimer) clearTimeout(autoOpenTimer);
    };
  }, [location.pathname, isPortal, hasInteracted, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setHasInteracted(true);
    sessionStorage.setItem('digiexplode_lead_modal_dismissed', 'true');
    logVisitorAction('Closed Lead Capture Popup');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    const cleanContact = contact.trim();
    const cleanEmail = email.trim();

    if (!cleanContact && !cleanEmail) {
      setErrorMsg('Please provide your WhatsApp/Phone Number so we can send the proposal.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createInboundLead({
        name: name.trim(),
        location: loc.trim() || 'Website Visitor',
        email: cleanEmail || undefined,
        contact: cleanContact || undefined,
        sourcePage: location.pathname,
        interest: selectedInterest,
        notes: `Inbound lead captured via pop-up form on ${location.pathname}. Interest: ${selectedInterest}.`
      });

      logVisitorAction(`Submitted Lead Form: ${name} (${selectedInterest})`);

      setIsSubmitting(false);
      setIsSubmitted(true);
      sessionStorage.setItem('digiexplode_lead_modal_dismissed', 'true');
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('An error occurred. Please try again or WhatsApp us directly.');
    }
  };

  if (isPortal) return null;

  return (
    <>
      {/* Floating Quick-Open Pill (Always accessible on bottom-right) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsSubmitted(false);
            logVisitorAction('Clicked Floating Proposal Badge');
          }}
          className="fixed bottom-6 right-20 sm:right-24 z-40 bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] hover:from-[#5A38EE] hover:to-[#1E4FE6] text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-black flex items-center gap-2 transform hover:scale-105 transition-all cursor-pointer border border-white/20 animate-pulse"
          aria-label="Request Free Growth Consultation"
        >
          <Sparkles className="w-4 h-4 text-[#B8F36B]" />
          <span>Get Free Proposal & Audit</span>
        </button>
      )}

      {/* Modal Backdrop & Window */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden transition-all text-[#0F172A] dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Clinical/Growth Gradient Header */}
            <div className="bg-gradient-to-r from-[#6C4CFF] via-[#2563FF] to-[#0284C7] p-5 text-white relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#B8F36B] animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[#BAE6FD]">
                  Instant Growth & Pricing Blueprint
                </span>
              </div>

              <h3 className="text-xl font-black text-white leading-tight">
                Scale Your Revenue With DigiExplode
              </h3>
              <p className="text-xs text-white/80 mt-1">
                Select your service & enter your WhatsApp to receive our custom execution proposal.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6">
              {isSubmitted ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Proposal Scheduled, {name}!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Our strategy director has received your request and will connect with your custom roadmap on WhatsApp within 15 minutes.
                  </p>

                  <div className="pt-3 flex flex-col gap-2">
                    <a
                      href={`https://wa.me/918725072730?text=${encodeURIComponent(
                        `Hi DigiExplodeAI, I am ${name} from ${loc || 'India'}. I just requested a proposal for ${selectedInterest}. Let's discuss!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" /> Chat on WhatsApp Right Now
                    </a>

                    <button
                      onClick={handleClose}
                      className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                    >
                      Done / Continue Browsing
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                  
                  {/* Quick Select: What are you looking to scale? */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      What are you interested in?
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {SERVICE_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = selectedInterest === opt.label;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedInterest(opt.label)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-[#2563FF] text-white border-[#2563FF] shadow-sm'
                                : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name (Mandatory) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Your Full Name / Business <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma / Dr. Pooja"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF] transition-all"
                      />
                    </div>
                  </div>

                  {/* WhatsApp / Phone (Primary) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>WhatsApp Number <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                        <MessageSquare className="w-3 h-3" /> Direct WhatsApp delivery
                      </span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-emerald-500 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={contact}
                        onChange={e => {
                          setContact(e.target.value);
                          setErrorMsg('');
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF] transition-all"
                      />
                    </div>
                  </div>

                  {/* Location & Optional Email */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        City / Location
                      </label>
                      <div className="relative">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="e.g. Chandigarh, Delhi"
                          value={loc}
                          onChange={e => setLoc(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Work Email (Optional)
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="email"
                          placeholder="rahul@company.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {errorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
                      {errorMsg}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-[#6C4CFF] via-[#2563FF] to-[#0284C7] hover:opacity-95 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    <span>{isSubmitting ? 'Submitting Details...' : 'Send Custom Proposal on WhatsApp'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> 100% Confidential
                    </span>
                    <span>•</span>
                    <span>Zero Spam</span>
                    <span>•</span>
                    <span>Response in 15 mins</span>
                  </div>

                </form>
              )}
            </div>

          </div>

        </div>
      )}
    </>
  );
};

export default LeadCaptureModal;
