import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEO/SEOHead';
import { siteConfig } from '../config/site';
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
  Bone
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
    focusProcedures: ['Knee & Hip Replacement', 'Spine Surgery & Slip Disc', 'Arthroscopy & Sports Injury', 'Joint Pain Management'],
    avgCostPerBooking: '₹220 - ₹380',
    expectedOpdBoost: '+140% OPD in 90 Days',
    strategySnippet: 'High-intent Google Ads for surgical consultations + Google Maps ranking for local joint pain searches.'
  },
  {
    id: 'derma',
    name: 'Dermatology & Hair',
    icon: Sparkles,
    focusProcedures: ['Hair Transplant & PRP', 'Laser Hair Removal', 'Acne Scar Treatment', 'Anti-Ageing & Aesthetics'],
    avgCostPerBooking: '₹180 - ₹290',
    expectedOpdBoost: '+220% Aesthetic OPD',
    strategySnippet: 'Educational Meta reels explaining clinical treatments + hyper-local Google Ads for cosmetic procedures.'
  },
  {
    id: 'gynae',
    name: 'Gynecology & IVF',
    icon: HeartPulse,
    focusProcedures: ['IVF & Fertility Treatment', 'High-Risk Pregnancy', 'PCOD / PCOS Care', 'Laparoscopic Gynae Surgery'],
    avgCostPerBooking: '₹250 - ₹420',
    expectedOpdBoost: '+95% High-Value Consults',
    strategySnippet: 'Empathy-driven doctor video branding + Google Search campaigns for verified fertility & pregnancy queries.'
  },
  {
    id: 'dental',
    name: 'Dental Care & Implants',
    icon: Smile,
    focusProcedures: ['Dental Implants', 'Invisalign & Clear Aligners', 'Root Canal & Crowns', 'Cosmetic Smile Makeover'],
    avgCostPerBooking: '₹140 - ₹240',
    expectedOpdBoost: '+180% High-Ticket OPD',
    strategySnippet: 'Google Maps Top-3 local pack dominance + before/after showcase ads compliant with dental advertising norms.'
  },
  {
    id: 'neuro',
    name: 'Neurology & Neurosurgery',
    icon: Brain,
    focusProcedures: ['Brain & Spine Tumor', 'Stroke & Epilepsy Care', 'Migraine & Nerve Disorders', 'Endoscopic Spine Surgery'],
    avgCostPerBooking: '₹300 - ₹500',
    expectedOpdBoost: '+80% Referral & Direct OPD',
    strategySnippet: 'Doctor authority branding + second-opinion landing pages targeting patients seeking senior surgeon guidance.'
  },
  {
    id: 'eye',
    name: 'Ophthalmology & Lasik',
    icon: Eye,
    focusProcedures: ['Bladeless Lasik Surgery', 'Micro-Incision Cataract', 'Glaucoma Management', 'Pediatric Vision Care'],
    avgCostPerBooking: '₹190 - ₹320',
    expectedOpdBoost: '+160% Procedure Queries',
    strategySnippet: 'Procedure comparison landing pages (Specs Removal / Lasik) with transparent FAQ lead funnels.'
  },
  {
    id: 'pediatrics',
    name: 'Pediatrics & Child Care',
    icon: Baby,
    focusProcedures: ['Newborn Intensive Care', 'Childhood Vaccination', 'Growth & Development', 'Pediatric Allergy & Asthma'],
    avgCostPerBooking: '₹150 - ₹260',
    expectedOpdBoost: '+120% Regular Families',
    strategySnippet: 'Hyper-local 5km radius ads targeting young parents + Google Maps reviews optimization for trusted care.'
  }
];

const CASE_STUDIES = [
  {
    doctor: 'Senior Neurosurgeon & Spine Specialist',
    location: 'Tricity (Chandigarh & Mohali)',
    challenge: 'Relied purely on hospital referrals; wanted direct, pre-screened OPD appointments for complex spine consultations.',
    solution: 'Built high-authority condition-specific video reels + Google Maps ranking for Spine Specialist near me.',
    results: [
      { metric: 'Direct OPD Consults', value: '+142%' },
      { metric: 'Avg Cost Per Patient', value: '₹280' },
      { metric: 'Monthly Surgical Inquiries', value: '38+' }
    ]
  },
  {
    doctor: 'Advanced Dermatology & Laser Clinic',
    location: 'Gurugram & Delhi NCR',
    challenge: 'High cost per lead from a previous agency with 60% irrelevant leads looking for cheap unverified treatments.',
    solution: 'Restructured Meta & Google campaigns around clinical treatments (PRP, Hair Transplant, Acne Scars) with instant WhatsApp pre-qualification.',
    results: [
      { metric: 'Show-Up Rate on OPD', value: '84%' },
      { metric: 'Patient Acquisition Cost', value: 'Dropped 58%' },
      { metric: 'High-Ticket Procedures', value: '3.4x Growth' }
    ]
  },
  {
    doctor: 'Center for Orthopaedics & Joint Care',
    location: 'Ludhiana & Punjab',
    challenge: 'Intense competition from corporate hospital chains in local Google search results.',
    solution: 'Dominated Google Local 3-Pack across 18 high-intent keywords + patient testimonial video engine.',
    results: [
      { metric: 'Google Maps Phone Calls', value: '450+ / month' },
      { metric: 'Surgery Conversions', value: '+92%' },
      { metric: 'Google Top-3 Rankings', value: '14 Keywords' }
    ]
  }
];

const FAQS = [
  {
    q: 'Is digital marketing legally and ethically allowed for doctors in India?',
    a: 'Yes, 100%. Under the National Medical Commission (NMC) and Indian Medical Council (MCI) guidelines, doctors are fully permitted to share educational health content, clinical expertise, qualifications, clinic timings, and location details. We strictly follow dignity-first, ethical healthcare marketing — no misleading claims, no sensationalism, and no discount gimmicks.'
  },
  {
    q: 'How fast can our clinic start seeing new patient inquiries?',
    a: 'Google Ads and hyper-local Meta campaigns typically start generating phone calls and WhatsApp consultation bookings within 72 hours of launch. Google Maps Local SEO rankings generally mature within 30 to 60 days, providing a long-term compounding source of organic patients.'
  },
  {
    q: 'Does the doctor need to spend hours shooting video content?',
    a: 'Not at all. We provide done-for-you script templates, scientifically tested medical questions patients ask most, and handle all professional editing, medical graphics, and distribution. You only need to invest 45-60 minutes once every two weeks.'
  },
  {
    q: 'Can you target patients specifically in a 5km to 15km radius of our clinic?',
    a: 'Yes. Healthcare is hyper-local. We use radius-based geo-fencing so your marketing budget is only spent on residents living within accessible driving distance of your clinic or hospital.'
  },
  {
    q: 'How do you prevent no-shows and irrelevant inquiries?',
    a: 'We integrate an automated WhatsApp confirmation and pre-screening bot. Patients receive instant clinic location maps, doctor credentials, and consultation fee details, ensuring only serious patients who value your time walk into your clinic.'
  }
];

export const DoctorMarketingPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ortho');
  const [monthlyOpdSlider, setMonthlyOpdSlider] = useState<number>(120);
  const [consultFeeSlider, setConsultFeeSlider] = useState<number>(800);

  // Doctor Form State
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Orthopaedics & Spine');
  const [clinicCity, setClinicCity] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic calculations for OPD boost
  const currentRevenue = monthlyOpdSlider * consultFeeSlider;
  const projectedExtraPatients = Math.round(monthlyOpdSlider * 0.95);
  const projectedExtraRevenue = projectedExtraPatients * consultFeeSlider;
  const estimatedMarketingRoi = ((projectedExtraRevenue / 35000) * 10).toFixed(1);

  const activeSpec = SPECIALTIES.find(s => s.id === selectedSpecialty) || SPECIALTIES[0];

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docPhone) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
      // Auto redirect to WhatsApp if wanted
      const msg = encodeURIComponent(
        `Hi DigiExplodeAI, I am Dr. ${docName} (${docSpecialty}) from ${clinicCity || 'my clinic'}. I would like to schedule a Doctor Growth Audit for my practice.`
      );
      window.open(`https://wa.me/918725072730?text=${msg}`, '_blank');
    }, 1000);
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': 'https://www.digiexplodeai.com/doctors',
    name: 'DigiExplodeAI — Healthcare & Doctor Performance Marketing',
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
    priceRange: '₹₹₹',
    sameAs: [
      'https://instagram.com/digiexplodeai',
      'https://linkedin.com/company/digiexplodeai'
    ]
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

      <div className="min-h-screen bg-[#070A14] text-[#F1F5F9] font-sans antialiased selection:bg-[#6C4CFF] selection:text-white">
        
        {/* ─── TOP MEDICAL COMPLIANCE BANNER ───────────────────────────── */}
        <div className="bg-gradient-to-r from-[#0E1528] via-[#141C38] to-[#0E1528] border-b border-[#6C4CFF]/20 px-4 py-2.5 text-center text-xs font-bold text-[#A78BFF] flex items-center justify-center gap-2 flex-wrap">
          <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-ping" />
          <span className="text-white">HEALTHCARE SPECIALIZATION:</span>
          <span>Exclusively Engineered for Doctors, Surgeons & Clinics</span>
          <span className="hidden md:inline text-white/30">•</span>
          <span className="hidden md:inline text-[#38BDF8]">100% NMC & MCI Ethical Advertising Compliant</span>
          <span className="hidden lg:inline text-white/30">•</span>
          <span className="hidden lg:inline text-[#34D399]">35+ Doctors Scaled</span>
        </div>

        {/* ─── HERO SECTION ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-12 md:pt-20 pb-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          {/* Ambient Glowing Gradients */}
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-radial from-[#6C4CFF]/20 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-radial from-[#06B6D4]/15 to-transparent blur-3xl pointer-events-none" />

          <div className="max-w-6xl mx-auto relative z-10 text-center">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6C4CFF]/15 border border-[#6C4CFF]/35 text-[#A78BFF] text-xs font-black uppercase tracking-wider mb-6">
              <Stethoscope className="w-4 h-4 text-[#38BDF8]" />
              <span>India's Dedicated Doctor Patient Growth System</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.12] mb-6">
              Attract High-Value Patients <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#806CFF] via-[#38BDF8] to-[#34D399]">
                On Autopilot
              </span> — Without Word-of-Mouth Reliance.
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg md:text-xl text-[#94A3B8] max-w-2xl mx-auto leading-relaxed mb-10">
              We help specialist doctors, surgeons, and clinic owners dominate Google Maps, attract surgical consultations via procedure ads, and build unshakable clinical authority in their city.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
              <a
                href="#doctor-audit-form"
                className="px-8 py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] hover:from-[#5A38EE] hover:to-[#1E4FE6] shadow-[0_10px_35px_rgba(108,76,255,0.4)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
              >
                <span>Book Free Doctor Growth Audit</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="tel:+918725072730"
                className="px-8 py-4 rounded-2xl font-bold text-sm text-[#F1F5F9] bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 transition-all flex items-center gap-2.5"
              >
                <Phone className="w-4 h-4 text-[#34D399]" />
                <span>Call Doctor Desk: +91 8725072730</span>
              </a>

              <a
                href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20a%20doctor%20interested%20in%20scaling%20my%20patient%20inflow"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-4 rounded-2xl font-bold text-sm text-[#34D399] bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 transition-all flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Instant WhatsApp Consult</span>
              </a>
            </div>

            {/* Credibility Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                { label: 'Doctors & Clinics Scaled', value: '35+', accent: 'text-[#A78BFF]' },
                { label: 'Avg Cost Per Patient Booking', value: '₹180 - ₹350', accent: 'text-[#38BDF8]' },
                { label: 'Verified Patients Driven', value: '14,000+', accent: 'text-[#34D399]' },
                { label: 'Google Maps Top-3 Timeframe', value: '30 - 45 Days', accent: 'text-[#F59E0B]' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-center hover:border-white/20 transition-all"
                >
                  <p className={`text-2xl sm:text-3xl font-black ${stat.accent} mb-1 tracking-tight`}>
                    {stat.value}
                  </p>
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── THE 4-PILLAR DOCTOR GROWTH SYSTEM ───────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-[#0A0E1C]">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#38BDF8] block mb-2">
                SYSTEMATIC CLINICAL GROWTH
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                The 4-Pillar Patient Acquisition Blueprint
              </h2>
              <p className="text-sm text-[#94A3B8] mt-3">
                Built specifically for medical professionals. No spam, no discounts, no vanity likes — only qualified patient consultations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  pillar: '01',
                  icon: MapPin,
                  title: 'Google Maps Top-3 Domination',
                  tagline: '70% of Local Patients Search Here',
                  desc: 'We optimize your Google Business Profile (GBP), medical categories, geo-tagged clinical photos, and 5-star patient review velocity to rank in the coveted Top-3 map pack.'
                },
                {
                  pillar: '02',
                  icon: Search,
                  title: 'High-Intent Procedure Google Ads',
                  tagline: 'Catch Urgent Surgical & Clinical Needs',
                  desc: 'Target high-value treatment keywords (e.g., "Knee replacement surgeon near me", "IVF clinic Sector 35"). Patients with immediate clinical need find your clinic first.'
                },
                {
                  pillar: '03',
                  icon: Video,
                  title: 'Doctor Authority Video Branding',
                  tagline: 'Patients Choose Doctors They Trust',
                  desc: 'We script and edit high-engagement medical education reels. When patients see you answering their genuine health concerns, you become their first choice.'
                },
                {
                  pillar: '04',
                  icon: MessageSquare,
                  title: 'Automated WhatsApp OPD Booking',
                  tagline: 'Cut Patient No-Shows by 65%',
                  desc: 'Instant clinic location pin, pre-consultation guidance, and automated appointment confirmations sent directly to patients via WhatsApp.'
                }
              ].map((p, i) => (
                <div
                  key={i}
                  className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.08] hover:border-[#6C4CFF]/40 transition-all flex flex-col justify-between group hover:-translate-y-1"
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-[#6C4CFF]/15 text-[#A78BFF] flex items-center justify-center font-bold">
                        <p.icon className="w-6 h-6" />
                      </div>
                      <span className="font-mono text-xs font-black text-white/30 group-hover:text-[#38BDF8] transition-colors">
                        PILLAR {p.pillar}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white mb-1.5 leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-[11px] font-bold text-[#38BDF8] mb-3">
                      {p.tagline}
                    </p>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      {p.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-1.5 text-[11px] font-bold text-[#A78BFF]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                    <span>Included in Medical Retainer</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── MEDICAL SPECIALTY SELECTOR & ROADMAP ────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#34D399] block mb-2">
                CUSTOM CLINICAL STRATEGY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                Tailored Playbooks for Your Specialty
              </h2>
              <p className="text-sm text-[#94A3B8] mt-3">
                Every medical domain has unique patient psychology, consultation fee dynamics, and advertising compliance boundaries.
              </p>
            </div>

            {/* Specialty Tab Selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-thin mb-8 justify-start md:justify-center">
              {SPECIALTIES.map(s => {
                const IconComponent = s.icon;
                const isSelected = s.id === selectedSpecialty;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSpecialty(s.id)}
                    className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-[#6C4CFF] text-white shadow-lg shadow-[#6C4CFF]/30 border border-[#806CFF]'
                        : 'bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Specialty Detail Showcase Card */}
            <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 backdrop-blur-xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
              
              <div className="lg:col-span-2 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 text-xs font-bold">
                  <span>Targeted Domain:</span>
                  <span className="font-black text-white">{activeSpec.name}</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  High-Impact Patient Acquisition for {activeSpec.name}
                </h3>

                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  {activeSpec.strategySnippet}
                </p>

                <div className="pt-2">
                  <p className="text-xs font-bold text-white uppercase tracking-wider mb-2.5">
                    High-Converting Priority Treatments & Procedures:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {activeSpec.focusProcedures.map((proc, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-semibold text-[#CBD5E1]"
                      >
                        ✓ {proc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Benchmarks Card */}
              <div className="rounded-2xl p-6 bg-[#0E1528] border border-[#6C4CFF]/30 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#A78BFF] uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-[#34D399]" />
                  <span>Clinical Benchmarks</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] text-[#64748B] font-bold uppercase">Expected Patient Growth</p>
                  <p className="text-lg font-black text-[#34D399] mt-0.5">{activeSpec.expectedOpdBoost}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[11px] text-[#64748B] font-bold uppercase">Estimated Cost Per Patient</p>
                  <p className="text-lg font-black text-[#38BDF8] mt-0.5">{activeSpec.avgCostPerBooking}</p>
                </div>

                <a
                  href="#doctor-audit-form"
                  onClick={() => setDocSpecialty(activeSpec.name)}
                  className="w-full py-3 rounded-xl bg-[#6C4CFF] hover:bg-[#5835F5] text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer block text-center"
                >
                  <span>Build {activeSpec.name} Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

            </div>

          </div>
        </section>

        {/* ─── REAL CASE STUDIES ───────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-[#080C1A]">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#A78BFF] block mb-2">
                VERIFIED CASE STUDIES
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                How Senior Doctors Scaled Their Private Practice
              </h2>
              <p className="text-sm text-[#94A3B8] mt-3">
                Real patient numbers delivered for specialist doctors across North India.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CASE_STUDIES.map((cs, i) => (
                <div
                  key={i}
                  className="rounded-3xl p-6 bg-white/[0.02] border border-white/[0.08] hover:border-white/20 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#6C4CFF]/20 text-[#A78BFF] border border-[#6C4CFF]/30">
                        Case Study 0{i + 1}
                      </span>
                      <span className="text-xs font-bold text-[#64748B] flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {cs.location}
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white">
                      {cs.doctor}
                    </h3>

                    <div className="text-xs text-[#94A3B8] space-y-2">
                      <p><strong className="text-white">Initial Challenge:</strong> {cs.challenge}</p>
                      <p><strong className="text-white">DigiExplodeAI Strategy:</strong> {cs.solution}</p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                    {cs.results.map((r, ri) => (
                      <div key={ri} className="p-2 rounded-xl bg-white/[0.03]">
                        <p className="text-base font-black text-[#34D399]">{r.value}</p>
                        <p className="text-[9px] font-semibold text-[#64748B] uppercase">{r.metric}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── INTERACTIVE OPD REVENUE & PATIENT CALCULATOR ─────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#38BDF8] block mb-2">
                PRACTICE ROI ESTIMATOR
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Calculate Your Projected OPD Growth
              </h2>
              <p className="text-xs text-[#94A3B8] mt-2">
                Adjust your current practice numbers to see your estimated monthly patient inflow upside.
              </p>
            </div>

            <div className="rounded-3xl p-6 sm:p-10 bg-gradient-to-br from-[#12182D] to-[#0A0D18] border border-[#6C4CFF]/30 shadow-2xl space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Slider 1: Current OPD */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#94A3B8]">Current Monthly OPD Consultations:</span>
                    <span className="text-base font-black text-[#A78BFF]">{monthlyOpdSlider} patients</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={monthlyOpdSlider}
                    onChange={e => setMonthlyOpdSlider(Number(e.target.value))}
                    className="w-full accent-[#6C4CFF] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#64748B] font-mono">
                    <span>30/mo</span>
                    <span>250/mo</span>
                    <span>500+/mo</span>
                  </div>
                </div>

                {/* Slider 2: Consultation Fee */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#94A3B8]">Avg. Consultation Fee (INR):</span>
                    <span className="text-base font-black text-[#38BDF8]">₹{consultFeeSlider}</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="2500"
                    step="100"
                    value={consultFeeSlider}
                    onChange={e => setConsultFeeSlider(Number(e.target.value))}
                    className="w-full accent-[#38BDF8] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#64748B] font-mono">
                    <span>₹400</span>
                    <span>₹1,500</span>
                    <span>₹2,500</span>
                  </div>
                </div>

              </div>

              {/* Output Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 text-center">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">Projected Extra Patients</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#34D399] mt-1">+{projectedExtraPatients}/mo</p>
                  <p className="text-[10px] text-white/40 mt-1">Direct pre-screened bookings</p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/5 text-center">
                  <p className="text-[11px] font-bold text-[#64748B] uppercase">Potential OPD Revenue Boost</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#38BDF8] mt-1">+₹{(projectedExtraRevenue / 1000).toFixed(0)}k/mo</p>
                  <p className="text-[10px] text-white/40 mt-1">Excluding follow-ups & surgeries</p>
                </div>

                <div className="p-4 rounded-2xl bg-[#6C4CFF]/15 border border-[#6C4CFF]/40 text-center">
                  <p className="text-[11px] font-bold text-[#A78BFF] uppercase">Estimated Practice ROI</p>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-1">{estimatedMarketingRoi}x</p>
                  <p className="text-[10px] text-[#A78BFF] mt-1">On marketing investment</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <a
                  href="#doctor-audit-form"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-[#6C4CFF] to-[#2563FF] shadow-lg hover:shadow-xl transition-all cursor-pointer"
                >
                  <span>Request Custom Practice Growth Roadmap</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

            </div>

          </div>
        </section>

        {/* ─── GENERAL AGENCY VS DIGIEXPLODEAI COMPARISON ───────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5 bg-[#0A0E1C]">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center max-w-xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#F59E0B] block mb-2">
                THE HEALTHCARE ADVANTAGE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Why Doctors Switch to DigiExplodeAI
              </h2>
            </div>

            <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/[0.02]">
              <div className="grid grid-cols-2 p-4 sm:p-5 bg-white/[0.04] border-b border-white/10 text-xs font-black uppercase tracking-wider">
                <span className="text-rose-400">Typical General Agency</span>
                <span className="text-[#34D399]">DigiExplodeAI Doctor Engine</span>
              </div>

              {[
                {
                  bad: 'Violates NMC / MCI ethical advertising norms with discount coupons',
                  good: '100% compliant, dignified medical education & patient guidance'
                },
                {
                  bad: 'Targets vague terms ("health clinic near me") bringing irrelevant inquiries',
                  good: 'Targets exact procedures ("ACL surgery cost", "PCOD fertility care")'
                },
                {
                  bad: 'Doesn’t understand medical terms, procedures, or doctor specializations',
                  good: 'Experienced medical copywriters who know sub-specialties & clinical value'
                },
                {
                  bad: 'High patient no-show rate; zero appointment confirmation automation',
                  good: 'Automated WhatsApp confirmations, location map pins & fee pre-screening'
                },
                {
                  bad: 'Reports clicks and impressions — zero clinic OPD accountability',
                  good: 'Weekly reports tracking verified patient calls, WhatsApp consults & appointments'
                }
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 p-4 sm:p-5 border-b border-white/5 text-xs sm:text-sm font-medium gap-4 items-center hover:bg-white/[0.01]"
                >
                  <div className="flex items-start gap-2 text-[#94A3B8]">
                    <span className="text-rose-500 font-bold shrink-0">✕</span>
                    <span>{row.bad}</span>
                  </div>
                  <div className="flex items-start gap-2 text-white">
                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                    <span>{row.good}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── DOCTOR FAQS ─────────────────────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-white/5">
          <div className="max-w-3xl mx-auto">
            
            <div className="text-center mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#38BDF8] block mb-2">
                CLARITY & COMPLIANCE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                Frequently Asked Questions by Doctors
              </h2>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  className="p-5 sm:p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-[#6C4CFF]/40 transition-all"
                >
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-start gap-2">
                    <span className="text-[#38BDF8] font-black">Q.</span>
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── LEAD GENERATION / AUDIT BOOKING FORM ────────────────────── */}
        <section id="doctor-audit-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0B0F20] to-[#070A14]">
          <div className="max-w-2xl mx-auto">
            
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34D399]/15 border border-[#34D399]/30 text-[#34D399] text-xs font-black uppercase tracking-wider mb-3">
                <FileCheck2 className="w-4 h-4" />
                <span>CONFIDENTIAL 1-ON-1 DOCTOR SESSION</span>
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                Claim Your Free Practice Growth Audit
              </h2>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-2.5">
                We will analyze your clinic's local Google ranking, evaluate competitor patient volume in your pin code, and map a personalized OPD scaling blueprint.
              </p>
            </div>

            <div className="rounded-3xl p-6 sm:p-8 bg-[#11162B] border border-[#6C4CFF]/30 shadow-2xl relative overflow-hidden">
              
              {formSubmitted ? (
                <div className="text-center py-12 space-y-4 animate-in fade-in zoom-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-white">
                    Audit Request Received, Dr. {docName}!
                  </h3>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                    Our Senior Healthcare Growth Strategist will contact you within 2 business hours. A WhatsApp confirmation has been initiated.
                  </p>
                  <div className="pt-4 flex justify-center gap-3">
                    <a
                      href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20Dr.%20looking%20for%20practice%20growth"
                      className="px-6 py-3 rounded-xl bg-[#25D366] text-white font-black text-xs flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp Us Now
                    </a>
                    <button
                      onClick={() => setFormSubmitted(false)}
                      className="px-4 py-3 rounded-xl border border-white/20 text-xs font-bold text-white hover:bg-white/10"
                    >
                      Submit Another Query
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                        Doctor Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Vikram Sharma"
                        value={docName}
                        onChange={e => setDocName(e.target.value)}
                        className="w-full bg-[#080B17] border border-white/10 rounded-xl px-3.5 py-3 text-xs font-semibold text-white placeholder-white/30 outline-none focus:border-[#6C4CFF] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                        Medical Specialty *
                      </label>
                      <select
                        value={docSpecialty}
                        onChange={e => setDocSpecialty(e.target.value)}
                        className="w-full bg-[#080B17] border border-white/10 rounded-xl px-3.5 py-3 text-xs font-semibold text-white outline-none focus:border-[#6C4CFF] transition-all cursor-pointer"
                      >
                        {SPECIALTIES.map(s => (
                          <option key={s.id} value={s.name} className="bg-[#11162B] text-white">
                            {s.name}
                          </option>
                        ))}
                        <option value="Multi-Specialty Hospital" className="bg-[#11162B] text-white">
                          Multi-Specialty Hospital / Clinic
                        </option>
                        <option value="Other Medical Domain" className="bg-[#11162B] text-white">
                          Other Specialty
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                        Clinic / Hospital City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chandigarh, Gurugram, Delhi..."
                        value={clinicCity}
                        onChange={e => setClinicCity(e.target.value)}
                        className="w-full bg-[#080B17] border border-white/10 rounded-xl px-3.5 py-3 text-xs font-semibold text-white placeholder-white/30 outline-none focus:border-[#6C4CFF] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                        WhatsApp / Contact Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 00000"
                        value={docPhone}
                        onChange={e => setDocPhone(e.target.value)}
                        className="w-full bg-[#080B17] border border-white/10 rounded-xl px-3.5 py-3 text-xs font-semibold text-white placeholder-white/30 outline-none focus:border-[#6C4CFF] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 mt-2 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-[#6C4CFF] via-[#2563FF] to-[#38BDF8] hover:opacity-95 shadow-[0_8px_30px_rgba(108,76,255,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Securing Doctor Slot...' : 'Schedule Confidential Doctor Strategy Call'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-[#64748B]">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" /> 100% Confidential
                    </span>
                    <span>•</span>
                    <span>No Obligation</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[#38BDF8]" /> Direct: +91 8725072730
                    </span>
                  </div>

                </form>
              )}

            </div>

            {/* Direct Contacts Row */}
            <div className="mt-8 text-center text-xs text-[#94A3B8] space-y-1">
              <p>Prefer direct conversation with our healthcare head?</p>
              <div className="flex items-center justify-center gap-6 pt-2 font-bold">
                <a href="tel:+918725072730" className="text-[#38BDF8] hover:underline flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> +91 8725072730
                </a>
                <span>|</span>
                <a
                  href="https://wa.me/918725072730?text=Hi%20DigiExplodeAI,%20I'm%20interested%20in%20digital%20marketing%20for%20doctors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#34D399] hover:underline flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Support
                </a>
                <span>|</span>
                <a href="mailto:digiexploadai@gmail.com" className="text-[#A78BFF] hover:underline">
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
