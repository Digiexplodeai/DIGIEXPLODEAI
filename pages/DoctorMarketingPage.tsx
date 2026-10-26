import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEO/SEOHead';
import {
  Stethoscope,
  Activity,
  Award,
  ShieldCheck,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle2,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  MapPin,
  Search,
  Video,
  Clock,
  ChevronRight,
  Star,
  FileCheck2,
  HeartPulse,
  Brain,
  Eye,
  Smile,
  Baby,
  Bone,
  Check,
  AlertCircle,
  Building2,
  FileText,
  BadgeCheck,
  Shield,
  Zap,
  HelpCircle
} from 'lucide-react';

interface SpecialtyCard {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  focusProcedures: string[];
  avgCostPerBooking: string;
  expectedOpdBoost: string;
  strategySnippet: string;
}

const SPECIALTIES: SpecialtyCard[] = [
  {
    id: 'ortho',
    name: 'Orthopaedics & Spine',
    icon: Bone,
    focusProcedures: ['Total Knee & Hip Replacement', 'Spine & Slip Disc Decompression', 'Sports Injury Arthroscopy', 'Robotic Joint Surgery'],
    avgCostPerBooking: '₹220 - ₹380',
    expectedOpdBoost: '+140% OPD Inflow in 60-90 Days',
    strategySnippet: 'High-intent procedure Google Ads capturing immediate surgery decisions + Google Maps top-3 ranking for local joint pain searches.'
  },
  {
    id: 'derma',
    name: 'Dermatology & Hair',
    icon: Sparkles,
    focusProcedures: ['Hair Transplant & PRP Therapy', 'Laser Hair Reduction', 'Acne Scar Resurfacing', 'Anti-Ageing & Clinical Aesthetics'],
    avgCostPerBooking: '₹180 - ₹290',
    expectedOpdBoost: '+210% Aesthetic Inflow',
    strategySnippet: 'Educational Meta reels breaking down treatment science + hyper-local aesthetic search ads within a 10 km clinic radius.'
  },
  {
    id: 'gynae',
    name: 'Gynecology & IVF',
    icon: HeartPulse,
    focusProcedures: ['IVF & Fertility Consultations', 'High-Risk Pregnancy Care', 'Laparoscopic Hysterectomy', 'PCOS & Hormonal Health'],
    avgCostPerBooking: '₹250 - ₹420',
    expectedOpdBoost: '+165% Consultation Volume',
    strategySnippet: 'Empathy-first informative video content answering patient anxieties + targeted local awareness funnels for fertility & maternity.'
  },
  {
    id: 'dental',
    name: 'Dental & Implantology',
    icon: Smile,
    focusProcedures: ['Full-Mouth Dental Implants', 'Invisalign & Clear Aligners', 'Smile Makeovers & Veneers', 'Root Canal & Laser Dentistry'],
    avgCostPerBooking: '₹150 - ₹280',
    expectedOpdBoost: '+180% High-Value Patient Footfall',
    strategySnippet: 'High-ticket implant search campaigns targeting affluent pin-codes + 5-star Google review automation to establish top clinic authority.'
  },
  {
    id: 'neuro',
    name: 'Neurology & Neurosurgery',
    icon: Brain,
    focusProcedures: ['Minimally Invasive Spine Surgery', 'Stroke & Brain Tumor Consults', 'Epilepsy & Migraine Management', 'Neuro-Rehabilitation'],
    avgCostPerBooking: '₹290 - ₹480',
    expectedOpdBoost: '+125% Specialized Consultations',
    strategySnippet: 'Super-specialist reputation architecture on Google + scientific doctor thought-leadership articles highlighting clinical milestones.'
  },
  {
    id: 'eye',
    name: 'Ophthalmology & Lasik',
    icon: Eye,
    focusProcedures: ['Blade-Free Robotic Lasik', 'Micro-Incision Cataract Surgery', 'Retina & Glaucoma Specialty', 'Pediatric Vision Care'],
    avgCostPerBooking: '₹190 - ₹340',
    expectedOpdBoost: '+175% Procedure Bookings',
    strategySnippet: 'Hyper-targeted Lasik eligibility campaigns for young professionals + community reputation campaigns for cataract procedures.'
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics & Neonatology',
    icon: Baby,
    focusProcedures: ['Newborn Care & Neonatology', 'Vaccination & Milestone Tracking', 'Childhood Asthma & Allergies', 'Pediatric Nutrition'],
    avgCostPerBooking: '₹140 - ₹240',
    expectedOpdBoost: '+150% Repeat Family OPD',
    strategySnippet: 'Trust-based parent education campaigns on Instagram & WhatsApp + Google Maps ranking when frantic parents search "pediatrician near me".'
  }
];

const CASE_STUDIES = [
  {
    doctor: 'Dr. Anupam Jindal',
    credentials: 'M.Ch Neurosurgery (PGI) • Senior Neurosurgeon',
    clinic: 'Spine & Neuro Clinic • North India',
    metrics: [
      { label: 'Monthly Spine Consults', value: '+185%' },
      { label: 'Google Maps Rank', value: '#1 in Region' },
      { label: 'Cost Per Inquiry', value: '₹310' }
    ],
    tag: 'Neurosurgery & Spine'
  },
  {
    doctor: 'Dr. Manishi Bansal',
    credentials: 'MD Dermatology • Aesthetic Dermatologist',
    clinic: 'Skin & Laser Centre • Tricity',
    metrics: [
      { label: 'Aesthetic Footfall', value: '+240%' },
      { label: 'Hair Transplant Leads', value: '65+ / Month' },
      { label: 'Review Score', value: '4.9 ★ (820+ Reviews)' }
    ],
    tag: 'Dermatology & Hair'
  },
  {
    doctor: 'Dr. Sankalp Sharma',
    credentials: 'MDS Oral & Maxillofacial Surgery',
    clinic: 'Dental Implant & Facial Surgery Centre',
    metrics: [
      { label: 'Full-Mouth Implants', value: '3.2x Growth' },
      { label: 'Google Search Traffic', value: '+320%' },
      { label: 'Cost Per Booking', value: '₹220' }
    ],
    tag: 'Implantology'
  }
];

const FAQS = [
  {
    q: 'Is digital marketing compliant with NMC (National Medical Commission) guidelines?',
    a: 'Yes, 100%. We strictly operate within NMC and Indian Medical Council ethical advertising guidelines. We never use banned gimmicks, guarantee cures, or engage in price discounting. Instead, we focus strictly on scientific patient education, doctor credential authority, clinic accessibility, and honest patient reviews.'
  },
  {
    q: 'How fast can our clinic start seeing new patient inquiries?',
    a: 'Google Ads campaigns for high-intent procedures typically begin generating direct phone calls and WhatsApp consultation requests within 48 to 72 hours of launch. Google Maps Local Pack SEO rankings generally mature within 30 to 60 days, providing compounding organic footfall.'
  },
  {
    q: 'Does the doctor need to spend long hours shooting videos or managing ads?',
    a: 'Not at all. We respect your clinical schedule. We provide plug-and-play script templates answering the exact clinical questions patients ask. You only need to record for 45 to 60 minutes once every two weeks. Our healthcare media team handles all editing, medical graphics, publishing, and ad management.'
  },
  {
    q: 'Can you target patients within a specific 5 km to 15 km driving radius of our hospital?',
    a: 'Yes. Medical care is local. We use precision geo-fencing targeting affluent, accessible residential sectors and corporate tech hubs within your reachable driving zone so no marketing budget is wasted.'
  },
  {
    q: 'How do you filter non-serious inquiries and prevent clinic no-shows?',
    a: 'We deploy an automated WhatsApp appointment bot. Every inquiring patient immediately receives doctor credentials, clinic Google Maps location pin, consultation timings, and fee details. The bot sends automated 2-hour appointment reminders, ensuring only committed patients reach your OPD desk.'
  }
];

export const DoctorMarketingPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ortho');
  const [monthlyOpdSlider, setMonthlyOpdSlider] = useState<number>(140);
  const [consultFeeSlider, setConsultFeeSlider] = useState<number>(800);

  // Form State
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Orthopaedics & Spine');
  const [clinicCity, setClinicCity] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculations
  const currentOpdRevenue = monthlyOpdSlider * consultFeeSlider;
  const projectedExtraPatients = Math.round(monthlyOpdSlider * 0.95);
  const projectedExtraRevenue = projectedExtraPatients * consultFeeSlider;
  const annualRevenueUpside = (projectedExtraRevenue * 12).toLocaleString('en-IN');

  const activeSpec = SPECIALTIES.find(s => s.id === selectedSpecialty) || SPECIALTIES[0];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docPhone) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      const msg = encodeURIComponent(
        `Hello DigiExplodeAI Healthcare Team, I am Dr. ${docName} (${docSpecialty}) from ${clinicCity || 'my clinic'}. I would like to schedule a confidential Doctor Growth Audit for my practice.`
      );
      window.open(`https://wa.me/918725072730?text=${msg}`, '_blank');
    }, 800);
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    '@id': 'https://www.digiexplodeai.com/doctors',
    name: 'DigiExplodeAI — Healthcare & Doctor Performance Marketing Division',
    description: 'Premier digital marketing agency engineered exclusively for doctors, surgeons, clinics, and hospitals in India. Boost patient inflow with ethical, high-converting digital campaigns.',
    url: 'https://www.digiexplodeai.com/doctors',
    telephone: '+91 8725072730',
    areaServed: 'India',
    serviceType: [
      'Doctor Digital Marketing',
      'Clinic Google Maps SEO',
      'Doctor Video Branding',
      'Healthcare PPC Advertising',
      'Hospital Patient Acquisition Funnels'
    ],
    priceRange: '₹₹₹'
  };

  return (
    <>
      <SEOHead
        title="Digital Marketing for Doctors & Healthcare Clinics — #1 Patient Growth Agency | DigiExplodeAI"
        description="Explode your clinic OPD appointments by 100% to 250%. India's dedicated healthcare marketing agency for doctors, surgeons & clinics. Ethical NMC compliance, Google Maps SEO, and high-intent procedure ads."
        keywords="digital marketing for doctors, healthcare marketing agency, doctor SEO, clinic marketing, patient acquisition for doctors, OPD growth agency, Meta ads for doctors, Google ads for clinic, DigiExplodeAI healthcare"
        canonicalUrl="https://www.digiexplodeai.com/doctors"
        jsonLd={jsonLd}
      />

      {/* Main Container — Crisp Clinical Medical Light Aesthetic */}
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-[#0284C7] selection:text-white">
        
        {/* ─── DEDICATED TOP HEALTHCARE BANNER (Proper top clearance for fixed header) ─── */}
        <div className="pt-24 sm:pt-28 pb-3 px-4 bg-gradient-to-r from-[#0284C7] via-[#0369A1] to-[#0A2540] text-white text-xs font-semibold shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#34D399] animate-pulse" />
              <span className="font-extrabold uppercase tracking-wider text-[#BAE6FD]">HEALTHCARE DIVISION:</span>
              <span>Dedicated Practice Growth Partner For Doctors & Hospitals Across India</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-[#E0F2FE] text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" /> 100% NMC / MCI Ethical Compliance
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#38BDF8]" /> Direct Doctor Desk: +91 8725072730
              </span>
            </div>
          </div>
        </div>

        {/* ─── HERO SECTION (Clinical Split Layout With Real Doctor Photography) ─── */}
        <section className="relative overflow-hidden pt-10 sm:pt-14 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F0F9FF] via-[#F8FAFC] to-white border-b border-slate-200/80">
          
          {/* Subtle Ambient Background Grids */}
          <div className="absolute inset-0 bg-[radial-gradient(#0284c715_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Left Column: Doctor Value Proposition */}
              <div className="lg:col-span-7 text-left space-y-6">
                
                {/* Medical Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] border border-[#0284C7]/30 text-[#0284C7] text-xs font-black uppercase tracking-wider shadow-sm">
                  <Stethoscope className="w-4 h-4 text-[#0284C7]" />
                  <span>India's #1 Medical Patient Growth Engine</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-black text-[#0A2540] tracking-tight leading-[1.15]">
                  Fill Your Clinic OPD & OT With <br className="hidden sm:inline" />
                  <span className="text-[#0284C7] underline decoration-[#0284C7]/30 underline-offset-8">
                    High-Intent Patients
                  </span> — Every Single Month.
                </h1>

                {/* Subheading */}
                <p className="text-base sm:text-lg text-[#334155] max-w-2xl leading-relaxed">
                  We engineer predictable, ethical patient acquisition systems exclusively for specialist doctors, surgeons, and clinic owners. Dominate Google Maps in your city, capture high-ticket surgical inquiries, and build lasting medical prestige without discounting consultations.
                </p>

                {/* Clinical Trust Points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-xs sm:text-sm font-bold text-[#1E293B]">
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <BadgeCheck className="w-4 h-4 text-[#059669] flex-shrink-0" />
                    <span>100% NMC & MCI Ethical Advertising</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0284C7] flex-shrink-0" />
                    <span>Target High-Value Surgical Procedures</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <MapPin className="w-4 h-4 text-[#EA580C] flex-shrink-0" />
                    <span>Rank Top-3 on Google Maps in 45 Days</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <MessageSquare className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                    <span>Automated WhatsApp Pre-Screening & Reminders</span>
                  </div>
                </div>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-4">
                  <a
                    href="#doctor-audit-form"
                    className="px-7 py-3.5 rounded-xl font-black text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Request Free Practice Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <a
                    href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20a%20doctor%20interested%20in%20scaling%20my%20patient%20inflow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-[#10B981] hover:bg-[#059669] shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Doctor WhatsApp Desk</span>
                  </a>

                  <a
                    href="tel:+918725072730"
                    className="px-5 py-3.5 rounded-xl font-bold text-sm text-[#0F172A] bg-white hover:bg-slate-50 border border-slate-200 transition-all flex items-center gap-2 shadow-xs"
                  >
                    <Phone className="w-4 h-4 text-[#0284C7]" />
                    <span>+91 8725072730</span>
                  </a>
                </div>

                {/* Confidentiality Note */}
                <p className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  <span>All consultations are 100% confidential. No spam, no aggressive sales pitches.</span>
                </p>

              </div>

              {/* Right Column: Hero Doctor Visual with Floating Clinical Proof */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  
                  {/* Outer Clinical Glow Frame */}
                  <div className="absolute -inset-2 bg-gradient-to-tr from-[#0284C7]/20 via-[#38BDF8]/20 to-[#10B981]/20 rounded-3xl blur-xl opacity-70" />

                  {/* Main Doctor Photo Card */}
                  <div className="relative rounded-2xl overflow-hidden bg-white border-2 border-white shadow-2xl">
                    <img
                      src="/images/doctor-hero-male.jpg"
                      alt="Senior Doctor in Clinic — DigiExplodeAI Healthcare Partner"
                      className="w-full h-[460px] object-cover object-top"
                    />

                    {/* Gradient Overlay for bottom text legibility */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A2540] via-[#0A2540]/60 to-transparent p-6 text-white text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#38BDF8]">
                          Clinically Verified Systems
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white leading-tight">
                        Built for Doctors Who Demand Excellence
                      </h3>
                      <p className="text-xs text-slate-200 mt-1">
                        From Tricity & Delhi NCR to Mumbai, scaling 35+ prestigious medical practices.
                      </p>
                    </div>

                    {/* Floating Badge 1: Google Rating */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Patient Trust</p>
                        <p className="text-xs font-black text-slate-900">4.9 ★★★★★ (1.2k+ Reviews)</p>
                      </div>
                    </div>

                    {/* Floating Badge 2: OPD Boost */}
                    <div className="absolute top-20 right-4 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Verified Inflow</p>
                        <p className="text-xs font-black text-emerald-700">+140% OPD In 60 Days</p>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── REAL CLINICAL CREDENTIALS STRIP ─────────────────────────── */}
        <section className="py-8 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              
              <div className="p-3 border-r last:border-r-0 border-slate-100">
                <p className="text-3xl sm:text-4xl font-black text-[#0284C7] tracking-tight">35+</p>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">Specialist Doctors & Clinics</p>
              </div>

              <div className="p-3 border-r last:border-r-0 border-slate-100">
                <p className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight">₹180 - ₹350</p>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">Avg Cost Per Qualified Patient</p>
              </div>

              <div className="p-3 border-r last:border-r-0 border-slate-100">
                <p className="text-3xl sm:text-4xl font-black text-[#059669] tracking-tight">14,000+</p>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">OPD Consultations Driven</p>
              </div>

              <div className="p-3">
                <p className="text-3xl sm:text-4xl font-black text-[#EA580C] tracking-tight">30 - 45 Days</p>
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-1">To Google Maps Top-3 Ranking</p>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION: THE CLINICAL DIAGNOSIS (General Agency vs DigiExplodeAI) ─── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                CLINICAL DIAGNOSIS
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                Why Generic Marketing Agencies Fail Doctors
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                General digital agencies treat a super-specialist doctor like an e-commerce t-shirt store. Healthcare requires clinical empathy, medical terminology accuracy, and strict ethical compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              
              {/* Card 1: Generic Agencies */}
              <div className="p-8 rounded-2xl bg-white border border-rose-200/80 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">The Generic Agency Approach</h3>
                    <p className="text-xs text-rose-600 font-bold">Unethical, Ineffective & Risky</p>
                  </div>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Run discount promos</strong> ("50% off checkup") attracting non-paying price hunters and degrading your clinical authority.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Violate NMC / MCI advertising guidelines</strong> with exaggerated claims, putting your medical registration at risk.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Waste budgets on irrelevant queries</strong> because they don't understand the difference between OPD symptoms and surgical indications.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Massive no-show rate</strong> because leads are not pre-qualified with consultation fees and clinic maps.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: DigiExplodeAI Healthcare System */}
              <div className="p-8 rounded-2xl bg-white border-2 border-[#0284C7] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#0284C7] text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                  The Clinical Gold Standard
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0A2540]">DigiExplodeAI Healthcare Partner</h3>
                    <p className="text-xs text-[#0284C7] font-bold">Scientific, Ethical & Procedure-Focused</p>
                  </div>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-700 font-medium">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
                    <span><strong>Procedure-Intent Targeting:</strong> We target patients specifically searching for surgical procedures (Knee replacement, IVF, Lasik, Hair PRP, Implants).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
                    <span><strong>100% NMC Compliant:</strong> Strictly educational, scientific, and patient-first branding that elevates your prestige.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
                    <span><strong>Google Maps Top-3 Domination:</strong> Hyper-local SEO positioning your clinic at the absolute top of local map searches.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#059669] flex-shrink-0 mt-0.5" />
                    <span><strong>Automated WhatsApp Pre-Screening:</strong> Every inquiry is provided with clinic timings, doctor qualification, and consultation fees before booking.</span>
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </section>

        {/* ─── SECTION: 4-PILLAR PATIENT ACQUISITION BLUEPRINT ─────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                PRACTICE GROWTH SYSTEM
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                The 4 Pillars of Medical Patient Acquisition
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                How we take a private clinic or hospital department from sporadic walk-ins to a consistently booked surgical and OPD schedule.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '01',
                  title: 'Google Maps Local Pack Top-3',
                  desc: '82% of patients search "best [specialist] near me" when pain strikes. We optimize your Google Business profile, citations, and reviews to lock you in the top 3 spots.',
                  icon: MapPin,
                  color: 'text-[#0284C7]',
                  bg: 'bg-sky-50',
                  border: 'border-sky-200'
                },
                {
                  step: '02',
                  title: 'High-Intent Procedure Google Ads',
                  desc: 'Capture patients who have already decided on surgical intervention. We target surgical terms like "robotic knee replacement cost" or "laser hair clinic".',
                  icon: Search,
                  color: 'text-[#059669]',
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-200'
                },
                {
                  step: '03',
                  title: 'Doctor Authority Reels & Video Engine',
                  desc: 'We script and edit high-prestige 60-second video reels addressing patient fears, establishing trust before they ever step into your consultation room.',
                  icon: Video,
                  color: 'text-[#7C3AED]',
                  bg: 'bg-purple-50',
                  border: 'border-purple-200'
                },
                {
                  step: '04',
                  title: 'WhatsApp Automation & Zero No-Shows',
                  desc: 'Automated clinic directions, doctor credentials, and 2-hour appointment reminders sent to the patient’s WhatsApp, minimizing no-shows to under 4%.',
                  icon: MessageSquare,
                  color: 'text-[#EA580C]',
                  bg: 'bg-orange-50',
                  border: 'border-orange-200'
                }
              ].map((pillar, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0284C7] hover:shadow-lg transition-all duration-300 relative group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-slate-400 tracking-wider">PILLAR {pillar.step}</span>
                    <div className={`w-10 h-10 rounded-xl ${pillar.bg} border ${pillar.border} flex items-center justify-center ${pillar.color}`}>
                      <pillar.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-base font-black text-[#0A2540] mb-2 leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {pillar.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── SECTION: SPECIALTY-SPECIFIC PLAYBOOKS ───────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                CUSTOMIZED BY CLINICAL DOMAIN
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                Select Your Medical Specialty
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Every medical domain has distinct patient psychology and procedure economics. Explore our specialized blueprints:
              </p>
            </div>

            {/* Specialty Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {SPECIALTIES.map(s => {
                const Icon = s.icon;
                const isSelected = selectedSpecialty === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSpecialty(s.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-md shadow-sky-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Specialty Detail Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                <div className="lg:col-span-7 space-y-4 text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-50 border border-sky-200 text-[#0284C7] text-xs font-black">
                    <activeSpec.icon className="w-4 h-4" />
                    <span>Target Specialty Playbook</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-[#0A2540]">
                    {activeSpec.name} Patient Funnel
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeSpec.strategySnippet}
                  </p>

                  <div className="pt-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                      High-Yield Procedures We Focus On:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeSpec.focusProcedures.map((proc, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0284C7]" />
                          {proc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-[#F0F9FF] to-white p-6 rounded-2xl border border-sky-200/80 space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected Patient Growth</p>
                    <p className="text-xl font-black text-[#059669] mt-0.5">{activeSpec.expectedOpdBoost}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Cost Per Confirmed Booking</p>
                    <p className="text-xl font-black text-[#0284C7] mt-0.5">{activeSpec.avgCostPerBooking}</p>
                  </div>

                  <a
                    href="#doctor-audit-form"
                    className="w-full py-3 rounded-xl font-black text-xs text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>Request {activeSpec.name} Blueprint</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION: INTERACTIVE PRACTICE ROI & OPD CALCULATOR ───────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200">
          <div className="max-w-5xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                PRACTICE REVENUE SIMULATOR
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                Calculate Your Practice Growth Potential
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Estimate your monthly and annual revenue upside with our dedicated medical marketing engine.
              </p>
            </div>

            <div className="p-8 sm:p-10 rounded-3xl bg-[#F8FAFC] border-2 border-slate-200/90 shadow-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                
                {/* Sliders */}
                <div className="space-y-6 text-left">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Current Monthly OPD Patients
                      </label>
                      <span className="text-lg font-black text-[#0284C7]">{monthlyOpdSlider} Patients</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={400}
                      step={10}
                      value={monthlyOpdSlider}
                      onChange={e => setMonthlyOpdSlider(Number(e.target.value))}
                      className="w-full accent-[#0284C7] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 font-bold mt-1">
                      <span>40 / mo</span>
                      <span>400 / mo</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Doctor Consultation Fee
                      </label>
                      <span className="text-lg font-black text-[#059669]">₹{consultFeeSlider}</span>
                    </div>
                    <input
                      type="range"
                      min={400}
                      max={2500}
                      step={100}
                      value={consultFeeSlider}
                      onChange={e => setConsultFeeSlider(Number(e.target.value))}
                      className="w-full accent-[#059669] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 font-bold mt-1">
                      <span>₹400</span>
                      <span>₹2,500</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-3">
                    * Projections exclude high-ticket surgical procedure revenues, in-clinic diagnostics, and long-term patient family referrals, which typically represent 3x to 5x higher value.
                  </p>
                </div>

                {/* Calculation Outputs */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md space-y-4">
                  <div className="text-center p-4 rounded-xl bg-sky-50 border border-sky-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Projected Extra Inflow
                    </p>
                    <p className="text-3xl font-black text-[#0284C7] mt-1">
                      +{projectedExtraPatients} Patients / Mo
                    </p>
                    <p className="text-[11px] text-[#0369A1] font-semibold mt-0.5">
                      Nearly doubling your current clinic patient footfall
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Monthly OPD Upside</p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        +₹{projectedExtraRevenue.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Annual Revenue Boost</p>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">
                        +₹{annualRevenueUpside}
                      </p>
                    </div>
                  </div>

                  <a
                    href="#doctor-audit-form"
                    className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-[#0284C7] hover:bg-[#0369A1] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>Claim Your Growth Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION: ZERO TIME COMMITMENT (Doctor in Clinic Scene) ──── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white">
                  <img
                    src="/images/doctor-consultation-female.jpg"
                    alt="Doctor in consultation room — DigiExplodeAI Client Success"
                    className="w-full h-[400px] object-cover"
                  />
                  <div className="p-4 bg-white border-t border-slate-100 text-left">
                    <p className="text-xs font-black text-[#0A2540]">"Only 45 Minutes of My Time Every Fortnight"</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">DigiExplodeAI writes the scripts, plans the topics, and edits all medical videos seamlessly.</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2 text-left space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-[#0284C7]">
                  DESIGNED FOR BUSY SURGEONS & SPECIALISTS
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540] leading-tight">
                  You Focus On Healing Patients. <br />
                  We Handle The Entire Growth Engine.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We know your time is sacred. You shouldn't be fiddling with video editors, ad accounts, or social media algorithms between surgeries. We operate as your dedicated healthcare marketing department.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-bold text-slate-700">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0284C7] flex-shrink-0 mt-0.5" />
                    <span>Done-For-You Medical Video Scripts</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0284C7] flex-shrink-0 mt-0.5" />
                    <span>NMC Compliance Checked Before Publishing</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0284C7] flex-shrink-0 mt-0.5" />
                    <span>Google Reviews & Reputation Defense</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#0284C7] flex-shrink-0 mt-0.5" />
                    <span>Dedicated Healthcare Growth Manager</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION: REAL DOCTOR CASE STUDIES ───────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                PROVEN PRACTICE RESULTS
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                Trusted by 35+ Leading Medical Specialists
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Real patient inflow metrics achieved for senior consultants and hospital clinics across North India.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CASE_STUDIES.map((cs, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-[#F8FAFC] border border-slate-200 hover:border-[#0284C7] hover:shadow-lg transition-all text-left flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#0284C7] text-[10px] font-black uppercase tracking-wider mb-4">
                      {cs.tag}
                    </span>
                    <h3 className="text-lg font-black text-[#0A2540]">{cs.doctor}</h3>
                    <p className="text-xs text-[#0284C7] font-bold mt-0.5">{cs.credentials}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cs.clinic}</p>

                    <div className="grid grid-cols-3 gap-2 my-5 pt-4 border-t border-slate-200 text-center">
                      {cs.metrics.map((m, idx) => (
                        <div key={idx} className="p-2 rounded-xl bg-white border border-slate-200">
                          <p className="text-sm sm:text-base font-black text-[#0284C7]">{m.value}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs font-bold text-[#0284C7]">
                    <span>Verified Growth Partner</span>
                    <BadgeCheck className="w-4 h-4 text-[#059669]" />
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── SECTION: FREQUENTLY ASKED QUESTIONS ─────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#0284C7] block mb-2">
                CLINICAL CLARITY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540]">
                Frequently Asked Doctor Inquiries
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Everything you need to know about ethical digital marketing for doctors.
              </p>
            </div>

            <div className="space-y-4 text-left">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs"
                >
                  <h3 className="text-base font-black text-[#0A2540] flex items-center gap-2 mb-2">
                    <HelpCircle className="w-4 h-4 text-[#0284C7] flex-shrink-0" />
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── SECTION: CONFIDENTIAL DOCTOR STRATEGY AUDIT FORM ───────── */}
        <section id="doctor-audit-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-[#F0F9FF] border-t border-slate-200">
          <div className="max-w-3xl mx-auto text-center">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] border border-[#0284C7]/30 text-[#0284C7] text-xs font-black uppercase tracking-wider mb-4">
              <Stethoscope className="w-4 h-4 text-[#0284C7]" />
              <span>CONFIDENTIAL PRACTICE AUDIT</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-[#0A2540] tracking-tight">
              Request Your Free Doctor Growth Audit
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-xl mx-auto">
              Our Senior Healthcare Growth Strategist will analyze your clinic's current Google Maps position, local competition, and procedure search volume.
            </p>

            <div className="mt-10 p-8 sm:p-10 rounded-3xl bg-white border-2 border-[#0284C7]/20 shadow-2xl text-left">
              
              {formSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    Audit Request Received, Doctor.
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Our Senior Healthcare Growth Strategist will contact you within 2 business hours. A WhatsApp confirmation has been initiated.
                  </p>
                  <div className="pt-4 flex justify-center gap-3">
                    <a
                      href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20Dr.%20looking%20for%20practice%20growth"
                      className="px-6 py-3 rounded-xl bg-[#10B981] text-white font-black text-xs flex items-center gap-2 shadow-md"
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp Us Directly
                    </a>
                    <button
                      onClick={() => setFormSubmitted(false)}
                      className="px-4 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Submit Another Query
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Doctor Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Vikram Sharma"
                        value={docName}
                        onChange={e => setDocName(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-[#0284C7] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Medical Specialty *
                      </label>
                      <select
                        value={docSpecialty}
                        onChange={e => setDocSpecialty(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-900 outline-none focus:border-[#0284C7] focus:bg-white transition-all cursor-pointer"
                      >
                        {SPECIALTIES.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                        <option value="Multi-Specialty Hospital">Multi-Specialty Hospital / Clinic</option>
                        <option value="General Surgery">General Surgery</option>
                        <option value="Cardiology">Cardiology</option>
                        <option value="Other Specialty">Other Specialty</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Clinic / Hospital City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chandigarh, Gurugram, Delhi..."
                        value={clinicCity}
                        onChange={e => setClinicCity(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-[#0284C7] focus:bg-white transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        WhatsApp / Contact Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 00000"
                        value={docPhone}
                        onChange={e => setDocPhone(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-[#0284C7] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 mt-2 rounded-xl font-black text-sm text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Securing Doctor Slot...' : 'Schedule Confidential Doctor Strategy Call'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-[#059669]">
                      <ShieldCheck className="w-3.5 h-3.5" /> 100% Confidential
                    </span>
                    <span>•</span>
                    <span>No Obligation</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-[#0284C7]">
                      <Phone className="w-3.5 h-3.5" /> Direct: +91 8725072730
                    </span>
                  </div>

                </form>
              )}

            </div>

            {/* Direct Contacts Row */}
            <div className="mt-8 text-center text-xs text-slate-500 space-y-1">
              <p>Prefer direct conversation with our healthcare division head?</p>
              <div className="flex items-center justify-center gap-6 pt-2 font-bold flex-wrap">
                <a href="tel:+918725072730" className="text-[#0284C7] hover:underline flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> +91 8725072730
                </a>
                <span>|</span>
                <a
                  href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20interested%20in%20digital%20marketing%20for%20doctors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#059669] hover:underline flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Support
                </a>
                <span>|</span>
                <a href="mailto:digiexploadai@gmail.com" className="text-slate-600 hover:underline">
                  digiexploadai@gmail.com
                </a>
              </div>
            </div>

          </div>
        </section>

      </div>
    </>
  );
};

export default DoctorMarketingPage;
