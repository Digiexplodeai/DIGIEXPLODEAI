import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Sparkles, Send, Phone, Mail, MapPin, User, CheckCircle2, MessageSquare, ArrowRight, ShieldCheck } from 'lucide-react';
import { createInboundLead } from '../../lib/marketingLeads';
import { logVisitorAction } from '../../lib/marketingTracker';

export const LeadCaptureModal: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Do not show on admin/portal routes
  const isPortal = location.pathname.startsWith('/portal') ||
                   location.pathname.startsWith('/admin') ||
                   location.pathname.startsWith('/attendance') ||
                   location.pathname.startsWith('/attendence');

  useEffect(() => {
    if (isPortal) {
      setIsOpen(false);
      return;
    }

    // Check if dismissed in this session
    const sessionDismissed = sessionStorage.getItem('digiexplode_lead_modal_dismissed');
    if (!sessionDismissed && !hasInteracted) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        logVisitorAction('Lead Capture Popup Displayed');
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, isPortal, hasInteracted]);

  const handleClose = () => {
    setIsOpen(false);
    setHasInteracted(true);
    sessionStorage.setItem('digiexplode_lead_modal_dismissed', 'true');
    logVisitorAction('Closed Lead Capture Popup');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    // MANDATORY CONSTRAINT: At least one of Contact Details OR Email must be provided
    const hasEmail = email.trim().length > 0;
    const hasContact = contact.trim().length > 0;

    if (!hasEmail && !hasContact) {
      setErrorMsg('Please enter either your Contact Number or Email ID (at least one is required).');
      return;
    }

    setIsSubmitting(true);

    try {
      createInboundLead({
        name,
        location: loc,
        email: email || undefined,
        contact: contact || undefined,
        sourcePage: location.pathname,
        interest: location.pathname.includes('doctor') ? 'Doctor & Healthcare Marketing' : 'Digital Marketing & Growth',
        notes: `Submitted via website pop-up form on ${location.pathname}`
      });

      logVisitorAction(`Submitted Lead Form: ${name}`);

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
      {/* Floating Quick-Open Pill (Always accessible on bottom-left) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsSubmitted(false);
            logVisitorAction('Clicked Floating Growth Audit Badge');
          }}
          className="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] hover:from-[#5A38EE] hover:to-[#1E4FE6] text-white px-4 py-2.5 rounded-full shadow-2xl text-xs font-black flex items-center gap-2 transform hover:scale-105 transition-all cursor-pointer border border-white/20 animate-bounce duration-1000"
          aria-label="Request Free Growth Consultation"
        >
          <Sparkles className="w-4 h-4 text-[#B8F36B]" />
          <span>Get Free Growth Audit</span>
        </button>
      )}

      {/* Modal Backdrop & Window */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          
          <div
            className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#0D1224] border border-slate-200 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden transition-all text-[#0F172A] dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Clinical/Growth Gradient Header Strip */}
            <div className="bg-gradient-to-r from-[#6C4CFF] via-[#2563FF] to-[#0284C7] p-5 text-white relative">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-[#B8F36B] animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-[#BAE6FD]">
                  Limited Slot Available Today
                </span>
              </div>

              <h3 className="text-xl font-black text-white leading-tight">
                Unlock 2x-5x Growth For Your Business
              </h3>
              <p className="text-xs text-white/80 mt-1">
                Share your details for a complimentary audit & tailored strategy.
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {isSubmitted ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Thank You, {name}!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto leading-relaxed">
                    Our Senior Growth Strategist will connect with you within 30 minutes with your customized roadmap.
                  </p>

                  <div className="pt-3 flex flex-col gap-2">
                    <a
                      href={`https://wa.me/918725072730?text=${encodeURIComponent(
                        `Hi DigiExplodeAI, I am ${name} from ${loc || 'my city'}. I just filled the website inquiry form and would like to chat directly.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                    >
                      <MessageSquare className="w-4 h-4" /> Connect On WhatsApp Right Now
                    </a>

                    <button
                      onClick={handleClose}
                      className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      Continue Browsing Site
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
                  
                  {/* Name (Mandatory) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Your Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma / Dr. Pooja"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#6C4CFF] focus:bg-white dark:focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Your City / Location
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="e.g. Chandigarh, Mohali, Delhi NCR..."
                        value={loc}
                        onChange={e => setLoc(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#6C4CFF] focus:bg-white dark:focus:bg-white/10 transition-all"
                      />
                    </div>
                  </div>

                  {/* Contact Number & Email (At least one required) */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-[#2563FF] dark:text-[#38BDF8]">
                        Contact Information
                      </span>
                      <span className="text-[10px] font-bold text-rose-500">
                        * Provide at least one
                      </span>
                    </div>

                    {/* Contact Number */}
                    <div>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="tel"
                          placeholder="Contact / WhatsApp Number (e.g. +91 98765...)"
                          value={contact}
                          onChange={e => {
                            setContact(e.target.value);
                            setErrorMsg('');
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF] transition-all"
                        />
                      </div>
                    </div>

                    {/* Email ID */}
                    <div>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="email"
                          placeholder="Email ID (e.g. rahul@company.com)"
                          value={email}
                          onChange={e => {
                            setEmail(e.target.value);
                            setErrorMsg('');
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#2563FF] transition-all"
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
                    className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-[#6C4CFF] via-[#2563FF] to-[#0284C7] hover:opacity-95 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Submitting Details...' : 'Get My Free Growth Proposal'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 100% Confidential
                    </span>
                    <span>•</span>
                    <span>Zero Spam Policy</span>
                    <span>•</span>
                    <span>Direct: +91 8725072730</span>
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
