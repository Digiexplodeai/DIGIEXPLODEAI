import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEO/SEOHead';
import { useTheme } from '../context/ThemeContext';
import { DoctorMedical3DScene } from '../components/3D/DoctorMedical3DScene';
import { createInboundLead } from '../lib/marketingLeads';
import { logVisitorAction } from '../lib/marketingTracker';
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
  ChevronDown,
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
  HelpCircle,
  X,
  ExternalLink,
  BarChart3,
  Filter,
  Layers,
  ArrowUpRight,
  Lock,
  Target,
  Globe,
  Smartphone,
  Sun,
  Moon
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   SPECIALTY DATA (13 Specialties from Master Specification)
   ───────────────────────────────────────────────────────────────────────────── */
interface SpecialtyCard {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  focusProcedures: string[];
  avgCostPerBooking: string;
  expectedOpdBoost: string;
  strategySnippet: string;
  channels: string[];
  sampleContent: string;
}

const SPECIALTIES: SpecialtyCard[] = [
  {
    id: 'ortho',
    name: 'Orthopaedics & Spine',
    category: 'Surgical Specialty',
    icon: Bone,
    focusProcedures: ['Robotic Knee & Hip Replacement', 'Spine & Slip Disc Endoscopy', 'Sports Injury Arthroscopy', 'Complex Trauma Reconstruction'],
    avgCostPerBooking: '₹220 - ₹380',
    expectedOpdBoost: '+140% OPD Inflow in 60-90 Days',
    strategySnippet: 'High-intent procedure Google Ads capturing immediate surgery decisions + Google Maps top-3 ranking for local joint pain and spine searches.',
    channels: ['Google Search Ads', 'Google Maps Local Pack', 'Doctor Authority Video Reels', 'Surgical Landing Pages'],
    sampleContent: '60s Reels: "When Is Robotic Knee Replacement Actually Necessary vs Physiotherapy?"'
  },
  {
    id: 'derma',
    name: 'Dermatology & Hair',
    category: 'Aesthetic & Clinical',
    icon: Sparkles,
    focusProcedures: ['FUE Hair Transplant & GFC/PRP', 'Laser Hair Reduction & Pigmentation', 'Acne Scar Resurfacing', 'Clinical Anti-Ageing & Fillers'],
    avgCostPerBooking: '₹180 - ₹290',
    expectedOpdBoost: '+210% Aesthetic Inflow',
    strategySnippet: 'Educational Meta reels breaking down treatment science + hyper-local aesthetic search ads within a 12 km clinic radius.',
    channels: ['Instagram Reels', 'Meta Feed Ads', 'Google Local Search', 'WhatsApp Booking Automation'],
    sampleContent: 'Scientific Carousel: "PRP vs GFC for Hair Thinning: Evidence-Based Doctor Comparison"'
  },
  {
    id: 'ivf',
    name: 'IVF & Fertility',
    category: 'Super-Specialty',
    icon: HeartPulse,
    focusProcedures: ['Self-Cycle & Donor IVF/ICSI', 'PCOS & Endometriosis Fertility', 'Blastocyst Culture & PGT', 'Recurrent Implantation Failure'],
    avgCostPerBooking: '₹280 - ₹450',
    expectedOpdBoost: '+165% Consultation Volume',
    strategySnippet: 'Empathy-first informative video content addressing patient anxieties + targeted local awareness funnels for fertility & maternity.',
    channels: ['Meta Compassion Funnels', 'Google Search (High Intent)', 'Patient Video Testimonials', 'Confidential WhatsApp Desk'],
    sampleContent: 'Doctor Video: "3 Clinical Tests Every Couple Must Complete Before Deciding On IVF"'
  },
  {
    id: 'dental',
    name: 'Dental & Implantology',
    category: 'Clinical Practice',
    icon: Smile,
    focusProcedures: ['Full-Mouth Dental Implants (All-on-4)', 'Invisalign & Clear Aligners', 'Smile Makeovers & Ceramic Veneers', 'Laser Endodontics & Micro-RCT'],
    avgCostPerBooking: '₹150 - ₹280',
    expectedOpdBoost: '+180% High-Value Patient Footfall',
    strategySnippet: 'High-ticket implant search campaigns targeting affluent pin-codes + 5-star Google review automation to establish top clinic authority.',
    channels: ['Google Procedure Ads', 'Google Maps 3-Pack', 'Before/After Smile Case Visuals', 'Instant WhatsApp Screening'],
    sampleContent: 'Educational Reel: "Can You Get Permanent Teeth In 72 Hours? Full-Mouth Implants Explained"'
  },
  {
    id: 'neuro',
    name: 'Neurology & Neurosurgery',
    category: 'Super-Specialty',
    icon: Brain,
    focusProcedures: ['Minimally Invasive Spine Surgery (MISS)', 'Endoscopic Brain Tumor Surgery', 'Stroke Intervention & Neuro ICU', 'Epilepsy & Migraine Management'],
    avgCostPerBooking: '₹290 - ₹480',
    expectedOpdBoost: '+125% Specialized Consultations',
    strategySnippet: 'Super-specialist reputation architecture on Google + scientific doctor thought-leadership articles highlighting clinical milestones.',
    channels: ['Google Medical Search', 'Hospital Credential Profile', 'Specialist Case Vignettes', 'Referral Network Expansion'],
    sampleContent: 'Clinical Breakdown: "Slip Disc: When Can It Be Cured Without Open Surgery?"'
  },
  {
    id: 'eye',
    name: 'Ophthalmology & Lasik',
    category: 'Surgical Practice',
    icon: Eye,
    focusProcedures: ['Blade-Free Robotic Lasik / SMILE', 'Micro-Incision Cataract (Phaco/Toric)', 'Glaucoma & Diabetic Retinopathy', 'Corneal & Pediatric Ophthalmology'],
    avgCostPerBooking: '₹190 - ₹340',
    expectedOpdBoost: '+175% Procedure Bookings',
    strategySnippet: 'Hyper-targeted Lasik eligibility campaigns for young professionals + community reputation campaigns for advanced cataract procedures.',
    channels: ['Google Search Ads', 'Instagram Lifestyle Ads', 'Google Local Map Pack', 'Eligibility Quiz Lead Funnel'],
    sampleContent: 'Interactive Ad: "Take The 60-Second Quiz: Are You Eligible For Blade-Free SMILE Lasik?"'
  },
  {
    id: 'cardio',
    name: 'Cardiology & Heart Care',
    category: 'Critical Super-Specialty',
    icon: Activity,
    focusProcedures: ['Coronary Angiography & Angioplasty', 'Pacemaker & TAVI Procedures', 'Hypertension & Lipid Clinics', 'Heart Failure Rehabilitation'],
    avgCostPerBooking: '₹260 - ₹420',
    expectedOpdBoost: '+135% OPD & Preventive Footfall',
    strategySnippet: 'Preventive cardiology awareness funnels across Google and YouTube + urgent symptom search capture for cardiac consultation.',
    channels: ['Google Medical Ads', 'YouTube Health Education', 'Local Hospital Maps', 'Emergency Line Integration'],
    sampleContent: 'Doctor Video: "Chest Pain vs Gas: 4 Warning Signs You Should Never Ignore"'
  },
  {
    id: 'onco',
    name: 'Oncology & Cancer Care',
    category: 'Super-Specialty',
    icon: ShieldCheck,
    focusProcedures: ['Surgical Oncology & Tumor Resection', 'Targeted Immunotherapy & Chemotherapy', 'Radiation Oncology Consultations', 'Early Cancer Screening Packages'],
    avgCostPerBooking: '₹320 - ₹520',
    expectedOpdBoost: '+110% Second-Opinion Consults',
    strategySnippet: 'Trust-based second-opinion portals, credential storytelling of senior surgical oncologists, and dignified patient care guidance.',
    channels: ['Google Second-Opinion Ads', 'Doctor Credential Videos', 'Hospital SEO Authority', 'Confidential Care Desk'],
    sampleContent: 'Educational Video: "Why Getting A Second Opinion in Oncology Saves Lives & Directs Correct Therapy"'
  },
  {
    id: 'pulmo',
    name: 'Pulmonology & Chest',
    category: 'Clinical Specialty',
    icon: Stethoscope,
    focusProcedures: ['Severe Asthma & Allergy Diagnostics', 'COPD & Sleep Apnea (Polysomnography)', 'Post-COVID Fibrosis & Interstitial Lung', 'Bronchoscopy & Thoracoscopy'],
    avgCostPerBooking: '₹190 - ₹310',
    expectedOpdBoost: '+155% Chronic OPD Care',
    strategySnippet: 'Seasonal allergen and pollution-driven search campaigns + sleep study diagnostic funnels in metro cities.',
    channels: ['Google Search Ads', 'Seasonal Awareness Reels', 'Google Maps Local Pack', 'WhatsApp Health Checkups'],
    sampleContent: 'Explainer Carousel: "Chronic Cough For Over 3 Weeks? What Your Lungs Might Be Warning You About"'
  },
  {
    id: 'diab',
    name: 'Diabetology & Endocrinology',
    category: 'Lifestyle & Clinical',
    icon: TrendingUp,
    focusProcedures: ['Type-2 Diabetes Reversal Programs', 'Thyroid Disorder Management', 'Gestational Diabetes Consultations', 'Continuous Glucose Monitoring (CGM)'],
    avgCostPerBooking: '₹160 - ₹270',
    expectedOpdBoost: '+185% Retained Patient Base',
    strategySnippet: 'Evidence-based reversal & management campaigns turning one-time consults into long-term quarterly monitoring patients.',
    channels: ['Meta Video Education', 'Google Search (Specialist)', 'Monthly Diet Webinars', 'Automated Lab Test Alerts'],
    sampleContent: 'Doctor Video: "HbA1c Above 8.5? The 3 Clinical Steps We Take Before Increasing Medication"'
  },
  {
    id: 'gastro',
    name: 'Gastroenterology & Liver',
    category: 'Surgical & Diagnostic',
    icon: FileText,
    focusProcedures: ['Diagnostic Endoscopy & Colonoscopy', 'Fatty Liver & Cirrhosis Protocols', 'GERD & Acidity Precision Care', 'Laparoscopic GI & Gallbladder Surgery'],
    avgCostPerBooking: '₹210 - ₹360',
    expectedOpdBoost: '+145% Diagnostic Procedures',
    strategySnippet: 'Capturing persistent gut pain queries with reassuring doctor explanations and simple outpatient endoscopy scheduling.',
    channels: ['Google Search Ads', 'Google Local Map Pack', 'Digestive Health Reels', 'Reception WhatsApp Automation'],
    sampleContent: 'Doctor Reel: "Is It Just Acidity Or Gallbladder Stones? Key Differences To Know"'
  },
  {
    id: 'ent',
    name: 'ENT & Head-Neck Surgery',
    category: 'Surgical Specialty',
    icon: Users,
    focusProcedures: ['Functional Endoscopic Sinus Surgery (FESS)', 'Microscopic Ear Surgery & Tympanoplasty', 'Tonsillectomy & Adenoidectomy', 'Snoring & Obstructive Sleep Surgery'],
    avgCostPerBooking: '₹170 - ₹290',
    expectedOpdBoost: '+150% Surgical OPD',
    strategySnippet: 'High-intent search ads for chronic sinusitis and hearing loss + parent-focused pediatric ENT education on Instagram.',
    channels: ['Google Ads (Sinus / Ear)', 'Google Maps Local SEO', 'Educational Reels', 'Instant Clinic Location Pins'],
    sampleContent: 'Doctor Explainer: "Chronic Sinus Blockage: How FESS Restores Normal Breathing In 1 Hour"'
  },
  {
    id: 'hospital',
    name: 'Multispeciality Hospitals',
    category: 'Institutional Growth',
    icon: Building2,
    focusProcedures: ['Emergency & 24/7 Trauma Services', 'Comprehensive Super-Specialty OPDs', 'Cashless TPA & Insurance Desk', 'Executive Full-Body Health Checkups'],
    avgCostPerBooking: '₹180 - ₹320',
    expectedOpdBoost: '+190% Cross-Department Footfall',
    strategySnippet: 'Unified multi-department digital ecosystem integrating Google Maps supremacy for all specialties, 24/7 emergency discovery, and corporate health checkups.',
    channels: ['Omnichannel Google & Meta', 'Google Maps Department Pins', 'Corporate Health Ties', 'Centralized WhatsApp Reception'],
    sampleContent: 'Brand Campaign: "From Emergency Trauma to Advanced Robotic Surgery: World-Class Care In Your City"'
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   VERIFIED CLIENT CASE STUDIES
   ───────────────────────────────────────────────────────────────────────────── */
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
    tag: 'Neurosurgery & Spine',
    challenge: 'Relied heavily on offline patient word-of-mouth with minimal Google search visibility for high-ticket spine surgeries.',
    solution: 'Built procedure-intent Google search campaigns targeting minimally invasive spine surgery + ranked clinic in top 3 Google Maps for 14 primary clinical keywords.',
    deliverables: ['Custom High-Speed Clinical Website', 'Google Maps 3-Pack SEO', 'Doctor Authority Video Series', 'WhatsApp Patient Screen Bot']
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
    tag: 'Dermatology & Hair',
    challenge: 'High competition from aesthetic chains running aggressive discounts, degrading clinical prestige and attracting non-serious leads.',
    solution: 'Repositioned clinic as scientific, dermatologist-led center through evidence-based Reels and hyper-local procedure ads within 10 km.',
    deliverables: ['Doctor Video Scripting & Production', 'Meta Aesthetic Funnel', 'Automated Google Review System', 'High-Ticket Hair Lead Portal']
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
    tag: 'Dental & Implantology',
    challenge: 'Low volume of full-mouth rehabilitation cases despite advanced surgical infrastructure and 3D CBCT capabilities.',
    solution: 'Designed premium implant landing page targeting affluent sectors + automated WhatsApp consultation desk providing immediate pricing clarity.',
    deliverables: ['Implant Consultation Portal', 'Google Search Campaign', 'Interactive Smile Simulator', '2-Hour Reminder WhatsApp Bot']
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   GROWTH ECOSYSTEM STAGES (Interactive Patient Journey)
   ───────────────────────────────────────────────────────────────────────────── */
const ECOSYSTEM_STAGES = [
  {
    stage: '01',
    title: 'Patient Search',
    subtitle: 'High-Intent Clinical Queries',
    desc: 'When symptoms or pain strike, 84% of patients search Google on mobile ("best knee replacement surgeon near me", "laser hair clinic fees").',
    deliverable: 'High-intent search ad triggers & exact match procedure keywords.',
    metric: '< 2.4 sec search visibility',
    tag: 'Google Search & Maps'
  },
  {
    stage: '02',
    title: 'Digital Discovery',
    subtitle: 'Google Maps Top-3 & Ad Dominance',
    desc: 'The patient immediately sees your clinic in the Google Maps Local 3-Pack, reinforced by verified 4.9★ reviews and surgeon credentials.',
    deliverable: 'Local citation building, geo-fenced advertising & Google Business Profile dominance.',
    metric: 'Top-3 Local Pack in 45 Days',
    tag: 'Local Pack SEO'
  },
  {
    stage: '03',
    title: 'Website Visit',
    subtitle: 'Sub-Second Credential Experience',
    desc: 'Patient clicks to an ultra-fast, mobile-optimized clinical page explaining procedure science, doctor qualification, and clinic hygiene.',
    deliverable: 'NMC-compliant high-conversion landing page with doctor introduction video.',
    metric: '92+ Mobile Performance Score',
    tag: 'Web & Video Authority'
  },
  {
    stage: '04',
    title: 'Relevant Enquiry',
    subtitle: 'Zero-Friction Inbound Action',
    desc: 'Patient chooses between direct call, WhatsApp consultation desk, or scheduling a confidential callback with one tap.',
    deliverable: 'Contextual WhatsApp triggers, verified phone link, and direct inquiry capture.',
    metric: '18% - 24% Conversion Rate',
    tag: 'Lead Capture'
  },
  {
    stage: '05',
    title: 'Clinic Follow-Up',
    subtitle: 'Automated WhatsApp Pre-Screening',
    desc: 'Before visiting, patient automatically receives doctor credentials, clinic timings, Google Maps driving pin, and consultation fee structure.',
    deliverable: 'Automated 24/7 WhatsApp consultation routing and screening bot.',
    metric: 'Instant < 10 sec response',
    tag: 'WhatsApp Bot'
  },
  {
    stage: '06',
    title: 'Appointment Request',
    subtitle: 'Confirmed In-Person OPD Booking',
    desc: 'Patient arrives at your clinic on time with zero confusion on fees. Automated 2-hour appointment reminders drop no-shows under 4%.',
    deliverable: 'Calendar appointment sync and multi-channel reminder notifications.',
    metric: '< 4% Clinic No-Show Rate',
    tag: 'OPD Desk'
  },
  {
    stage: '07',
    title: 'Campaign Optimization',
    subtitle: 'Continuous ROAS & Surgery Scaling',
    desc: 'Our healthcare growth team analyzes which keywords drove actual surgical admissions, shifting ad budget to highest-margin procedures.',
    deliverable: 'Bi-weekly clinical performance report and continuous keyword tuning.',
    metric: '3x - 5x Practice ROAS',
    tag: 'Data Intelligence'
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   HEALTHCARE SERVICES BENTO DATA (9 Services)
   ───────────────────────────────────────────────────────────────────────────── */
const SERVICES_BENTO = [
  {
    id: 'google-ads',
    title: 'High-Intent Google Ads',
    badge: 'Immediate Inflow',
    desc: 'Capture patients actively searching for specific surgeries and treatments. Geo-fenced within your clinic driving zone.',
    features: ['Procedure-Intent Keyword Targeting', 'Negative Keyword Shielding (Blocks Free Seekers)', 'Dedicated Call & WhatsApp Tracking', 'Continuous Negative Search Audits'],
    icon: Search,
    color: '#126BFF',
    accentBg: 'bg-blue-500/10'
  },
  {
    id: 'meta-ads',
    title: 'Meta & Instagram Ads',
    badge: 'Authority Video',
    desc: 'Targeted visual storytelling on Instagram & Facebook. Educate local patients on treatment science and doctor credentials.',
    features: ['High-Income Pin-Code Geo-Targeting', 'Custom Video Reels & Carousels', 'A/B Creative Testing Engine', 'Direct Inbound WhatsApp Messaging'],
    icon: Video,
    color: '#7047FF',
    accentBg: 'bg-purple-500/10'
  },
  {
    id: 'local-seo',
    title: 'Google Maps & Local SEO',
    badge: 'Long-Term Asset',
    desc: 'Rank your clinic in the prestigious Google Maps 3-Pack for "best specialist near me". Generates compounding free organic footfall.',
    features: ['Google Business Profile Optimization', 'Healthcare Citation Distribution', 'Automated 5-Star Review Generation', 'Localized Medical Schema Markup'],
    icon: MapPin,
    color: '#00A8FF',
    accentBg: 'bg-sky-500/10'
  },
  {
    id: 'ai-search',
    title: 'AI Search Visibility',
    badge: 'Next-Gen Discovery',
    desc: 'Position your name and hospital as the recommended medical authority in ChatGPT, Perplexity AI, and Google AI Overviews.',
    features: ['Authoritative Medical Entity Graphing', 'NMC-Compliant Clinical Citation Data', 'Knowledge Base & Bio Optimization', 'Semantic Medical FAQ Structuring'],
    icon: Sparkles,
    color: '#10B981',
    accentBg: 'bg-emerald-500/10'
  },
  {
    id: 'web-dev',
    title: 'Doctor Website Engineering',
    badge: 'Sub-Second Speed',
    desc: 'Custom-built, blisteringly fast websites designed specifically to convert anxious patients into booked consultations.',
    features: ['Sub-Second Mobile Load Times', 'NMC Advertising Standard Compliant', 'Mobile Appointment Booking UI', 'Complete Practice Ownership'],
    icon: Globe,
    color: '#F59E0B',
    accentBg: 'bg-amber-500/10'
  },
  {
    id: 'social-media',
    title: 'Medical Social Branding',
    badge: 'Prestige & Trust',
    desc: 'Turn your medical knowledge into viral, high-trust educational content. Establish yourself as the foremost regional authority.',
    features: ['Doctor Thought Leadership Carousels', 'Clinical Infographics & Health Awareness', 'Community Comment Moderation', 'Zero Fake Medical Gimmicks'],
    icon: Users,
    color: '#EC4899',
    accentBg: 'bg-pink-500/10'
  },
  {
    id: 'video-reels',
    title: 'AI Video Production Engine',
    badge: 'Done-For-You',
    desc: 'We write the scripts, structure the clinical answers, and edit broadcast-grade 60-second reels from just 45 minutes of your time.',
    features: ['Done-For-You Teleprompter Scripts', 'Medical 3D Animations & Subtitles', 'Professional Color Grading & Sound', 'NMC Ethics Compliance Review'],
    icon: Smartphone,
    color: '#8B5CF6',
    accentBg: 'bg-violet-500/10'
  },
  {
    id: 'clinic-branding',
    title: 'Clinic Identity & Print Creative',
    badge: 'Visual Refinement',
    desc: 'Comprehensive clinic visual design that looks like an international hospital, from prescription pads to reception displays.',
    features: ['Premium Clinic Logo & Typography', 'Prescription Pad & Stationery Design', 'In-Clinic Educational Banners', 'Patient Discharge Folders'],
    icon: FileText,
    color: '#06B6D4',
    accentBg: 'bg-cyan-500/10'
  },
  {
    id: 'automation',
    title: 'WhatsApp Automation & CRM',
    badge: 'Zero No-Shows',
    desc: 'Automated clinic directions, doctor credentials, and 2-hour appointment reminders that cut clinic no-shows to under 4%.',
    features: ['Instant 24/7 WhatsApp Response Bot', 'Clinic Google Maps Location Dispatch', 'Consultation Fee & Timing Clarification', '2-Hour SMS & WhatsApp Reminders'],
    icon: MessageSquare,
    color: '#10B981',
    accentBg: 'bg-emerald-500/10'
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   CLINICAL FAQS (9 Key Questions from Master Spec)
   ───────────────────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: 'Is digital marketing compliant with NMC (National Medical Commission) guidelines?',
    a: 'Yes, 100%. We operate strictly within NMC and Indian Medical Council ethical advertising guidelines. We never use banned commercial gimmicks, guarantee cures, or engage in price discounting. Instead, we focus strictly on scientific patient education, doctor credential authority, clinic accessibility, and verified patient reviews.'
  },
  {
    q: 'How fast can our clinic start seeing new patient inquiries?',
    a: 'Google Ads campaigns for high-intent surgical and OPD procedures typically begin generating direct phone calls and WhatsApp consultation requests within 48 to 72 hours of launch. Google Maps Local Pack SEO rankings generally mature within 30 to 60 days, providing compounding organic footfall.'
  },
  {
    q: 'Does the doctor need to spend long hours shooting videos or managing ads?',
    a: 'Not at all. We respect your clinical schedule. We provide plug-and-play script templates answering the exact clinical questions patients ask. You only need to record for 45 to 60 minutes once every two weeks on your smartphone or clinic camera. Our healthcare media team handles all medical graphics, editing, publishing, and ad management.'
  },
  {
    q: 'Can you target patients within a specific 5 km to 15 km driving radius of our hospital?',
    a: 'Yes. Medical care is local. We use precision geo-fencing targeting affluent, accessible residential sectors and corporate tech hubs within your reachable driving zone so no marketing budget is wasted.'
  },
  {
    q: 'How do you filter non-serious inquiries and prevent clinic no-shows?',
    a: 'We deploy an automated WhatsApp appointment bot. Every inquiring patient immediately receives doctor credentials, clinic Google Maps location pin, consultation timings, and fee details. The bot sends automated 2-hour appointment reminders, ensuring only committed patients reach your OPD desk.'
  },
  {
    q: 'Can you manage Google Ads for my private clinic without violating healthcare ad policies?',
    a: 'Yes. Google has strict healthcare advertising restrictions (e.g. prescription medicines, speculative medical procedures). Because we specialize exclusively in medical marketing, our ad copy and landing pages are pre-vetted to pass Google healthcare verification without risk of account suspension.'
  },
  {
    q: 'Do you create professional doctor websites, and do we own the domain and code?',
    a: 'Yes. We engineer ultra-fast, mobile-first doctor websites built with clean code and modern responsive design. You retain 100% ownership of your domain, content, and patient inquiry data. No proprietary vendor lock-in.'
  },
  {
    q: 'How does your free digital growth audit work?',
    a: 'Our Senior Healthcare Growth Strategist audits your current Google Maps ranking, competitor search volume in your city, website mobile speed, and current online patient reputation. We present a clear, 1-page clinical growth roadmap showing exact keyword opportunities and projected inquiry volume.'
  },
  {
    q: 'Do you provide WhatsApp and CRM automation for patient follow-ups?',
    a: 'Yes. We connect your digital campaigns directly to a dedicated WhatsApp business API or clinic reception CRM. Inquiries are tracked in real time, and receptionists receive instant alerts when high-value procedure inquiries arrive.'
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   CLINICAL EDITORIAL ARTICLES
   ───────────────────────────────────────────────────────────────────────────── */
const INSIGHTS_ARTICLES = [
  {
    id: 'google-maps-seo',
    title: 'Google Maps 3-Pack Domination: The Clinical Playbook for Private Clinics',
    category: 'Medical SEO',
    readTime: '5 min read',
    snippet: 'Why 82% of emergency and specialist searches happen on Google Maps, and how local medical citations lock your clinic in the top 3 spots.',
    author: 'Healthcare SEO Team',
    date: 'Updated Oct 2026'
  },
  {
    id: 'procedure-ads',
    title: 'Procedure-Intent vs General Healthcare Ads: How Surgeons Lower Cost Per Booking',
    category: 'Google Ads',
    readTime: '4 min read',
    snippet: 'Why bidding on generic terms like "doctor" wastes budget, while surgical keywords like "robotic joint replacement cost" generate booked OTs.',
    author: 'PPC Strategy Division',
    date: 'Updated Oct 2026'
  },
  {
    id: 'nmc-compliance',
    title: 'NMC Ethical Guidelines: How Doctors Can Build Digital Presence Without Violation',
    category: 'Ethics & Compliance',
    readTime: '6 min read',
    snippet: 'A comprehensive doctor guide to ethical patient education, avoiding prohibited superlatives, and building lasting medical authority.',
    author: 'Regulatory Affairs Desk',
    date: 'Updated Oct 2026'
  },
  {
    id: 'doctor-video-branding',
    title: 'Doctor Video Branding: Scripting High-Trust Clinical Reels in 45 Minutes',
    category: 'Video Branding',
    readTime: '4 min read',
    snippet: 'The 3-act clinical explanation framework that calms patient fears, answers surgical FAQs, and positions you as the trusted regional consultant.',
    author: 'Creative Media Team',
    date: 'Updated Oct 2026'
  }
];

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT: DoctorMarketingPage
   ───────────────────────────────────────────────────────────────────────────── */
export const DoctorMarketingPage: React.FC = () => {
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();

  // Active States
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('ortho');
  const [activeJourneyStage, setActiveJourneyStage] = useState<number>(0);
  const [activePortfolioTab, setActivePortfolioTab] = useState<string>('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [showBeforeAfter, setShowBeforeAfter] = useState<boolean>(true);

  // Analytics Dashboard Demo State
  const [analyticsTimeRange, setAnalyticsTimeRange] = useState<'30d' | '90d' | 'all'>('30d');
  const [analyticsChannel, setAnalyticsChannel] = useState<'all' | 'google' | 'maps' | 'meta'>('all');

  // ROI Calculator Sliders
  const [monthlyOpdSlider, setMonthlyOpdSlider] = useState<number>(140);
  const [consultFeeSlider, setConsultFeeSlider] = useState<number>(800);

  // Modal State (Intent-Driven Consultation Audit Flow)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Audit Form State (Page & Modal Shared Logic)
  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Orthopaedics & Spine');
  const [clinicCity, setClinicCity] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [selectedServiceInterests, setSelectedServiceInterests] = useState<string[]>([
    'Google Ads & Patient Inflow',
    'Google Maps Top-3 Ranking'
  ]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculations for Simulator
  const projectedExtraPatients = Math.round(monthlyOpdSlider * 0.95);
  const projectedExtraRevenue = projectedExtraPatients * consultFeeSlider;
  const annualRevenueUpside = (projectedExtraRevenue * 12).toLocaleString('en-IN');

  const activeSpec = SPECIALTIES.find(s => s.id === selectedSpecialty) || SPECIALTIES[0];

  // Auto-fill specialty when modal opens from a specialty card
  const handleOpenAuditModal = (specName?: string) => {
    if (specName) {
      setDocSpecialty(specName);
    }
    setIsAuditModalOpen(true);
    logVisitorAction('Doctor Audit Modal Opened');
  };

  const handleCloseAuditModal = () => {
    setIsAuditModalOpen(false);
    setErrorMsg('');
  };

  // Keyboard Escape Handler for Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuditModalOpen) {
        handleCloseAuditModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuditModalOpen]);

  // Form Submission Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!docName.trim()) {
      setErrorMsg('Please enter doctor or clinic name.');
      return;
    }
    if (!docPhone.trim() || docPhone.trim().length < 8) {
      setErrorMsg('Please enter a valid WhatsApp or contact phone number.');
      return;
    }

    setIsSubmitting(true);

    try {
      createInboundLead({
        name: docName.trim(),
        location: clinicCity.trim() || 'India',
        contact: docPhone.trim(),
        sourcePage: '/doctors',
        interest: `${docSpecialty} Growth Audit (${selectedServiceInterests.join(', ')})`,
        notes: `Confidential Doctor Audit Request. Specialty: ${docSpecialty}, City: ${clinicCity}. Interested Services: ${selectedServiceInterests.join(', ')}`
      });

      logVisitorAction(`Doctor Audit Lead Generated: Dr. ${docName}`);

      setTimeout(() => {
        setIsSubmitting(false);
        setFormSubmitted(true);

        const prefilledMsg = encodeURIComponent(
          `Hello DigiExplode AI Healthcare Team, I am Dr. ${docName} (${docSpecialty}) from ${clinicCity || 'my clinic'}. I just requested a confidential Doctor Growth Audit on your website. My contact: ${docPhone}.`
        );
        window.open(`https://wa.me/918725072730?text=${prefilledMsg}`, '_blank');
      }, 700);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg('An error occurred. Please WhatsApp our direct healthcare desk at +91 8725072730.');
    }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    '@id': 'https://www.digiexplodeai.com/doctors',
    name: 'DigiExplode AI — Healthcare & Doctor Performance Marketing Division',
    description: 'Premier healthcare digital growth agency engineered exclusively for doctors, surgeons, clinics, and hospitals in India. Boost patient inflow with ethical NMC compliance, Google Maps SEO, and high-intent procedure campaigns.',
    url: 'https://www.digiexplodeai.com/doctors',
    telephone: '+91 8725072730',
    areaServed: 'India',
    serviceType: [
      'Doctor Digital Marketing',
      'Clinic Google Maps SEO',
      'Doctor Video Branding',
      'Healthcare Google Ads',
      'Hospital Patient Acquisition Systems'
    ],
    priceRange: '₹₹₹'
  };

  const isDarkMode = resolvedTheme === 'dark';

  return (
    <>
      <SEOHead
        title="Digital Marketing for Doctors & Healthcare Clinics — #1 Patient Growth Agency | DigiExplode AI"
        description="Explode clinic OPD appointments and high-value surgical procedures. India's dedicated healthcare marketing agency for specialist doctors, surgeons, clinics & hospitals. 100% NMC compliant."
        keywords="digital marketing for doctors, healthcare marketing agency, doctor SEO, clinic marketing, patient acquisition for doctors, OPD growth agency, Meta ads for doctors, Google ads for clinic, DigiExplode AI healthcare"
        canonicalUrl="https://www.digiexplodeai.com/doctors"
        jsonLd={jsonLd}
      />

      {/* Main Container — Dynamically theme-aware (Light Medical Blue or Futuristic Midnight Cyber Navy) */}
      <div className="relative min-h-screen bg-[#F5F8FF] dark:bg-[#07101E] text-[#101828] dark:text-[#F8FAFC] font-sans antialiased selection:bg-[#126BFF] selection:text-white transition-colors duration-300">

        {/* ─── DEDICATED TOP HEALTHCARE STATUS BANNER ──────────────────── */}
        <div className="pt-24 sm:pt-26 pb-3 px-4 bg-gradient-to-r from-[#EBF3FF] via-[#F0F7FF] to-[#E5EFFF] dark:from-[#050C17] dark:via-[#09152B] dark:to-[#0A2548] text-[#0A2540] dark:text-white text-xs font-semibold shadow-xs border-b border-blue-200/90 dark:border-blue-900/40 relative z-20 transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#126BFF] dark:bg-[#00A8FF] animate-pulse" />
              <span className="font-extrabold uppercase tracking-wider text-[#126BFF] dark:text-[#BAE6FD] text-[11px]">
                HEALTHCARE DIVISION:
              </span>
              <span className="text-[#334155] dark:text-slate-200 text-[11px] sm:text-xs">
                Dedicated Practice Growth Partner For Doctors, Clinics & Hospitals Across India
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 mx-auto sm:mx-0 text-[#0F172A] dark:text-[#E0F2FE] text-[11px] font-bold">
              <span className="hidden md:flex items-center gap-1 text-[#059669] dark:text-[#10B981]">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% NMC / MCI Ethical Compliance
              </span>
              <span className="hidden md:inline text-slate-300 dark:text-slate-600">•</span>
              <a href="tel:+918725072730" className="flex items-center gap-1 text-[#126BFF] dark:text-[#00A8FF] hover:underline">
                <Phone className="w-3.5 h-3.5" /> Direct: +91 8725072730
              </a>
              <span className="text-slate-300 dark:text-slate-600">•</span>

              {/* Theme Quick Switcher in Top Bar */}
              <button
                onClick={toggleTheme}
                type="button"
                className="px-2.5 py-1 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-all text-[10px] font-extrabold cursor-pointer border border-blue-200 dark:border-white/20 shadow-2xs"
                title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle Dark and Light Theme"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-3 h-3 text-[#BAE6FD]" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3 text-[#126BFF]" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ─── SECTION 01: HERO (Asymmetric Split Layout with Interactive 3D Medical Scene) ─── */}
        <section className="relative overflow-hidden pt-10 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F5F8FF] via-white to-[#F5F8FF] dark:from-[#07101E] dark:via-[#0A162B] dark:to-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          
          {/* Interactive 3D Medical & Digital Growth Canvas Background */}
          <DoctorMedical3DScene className="opacity-75 dark:opacity-90" />

          {/* Ambient Lighting Mesh Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#126bff12_1px,transparent_1px)] dark:bg-[radial-gradient(#00a8ff15_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* Left Column: Doctor Value Proposition & CTAs */}
              <div className="lg:col-span-7 text-left space-y-6">
                
                {/* Eyebrow Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF4FF] dark:bg-[#122442] border border-[#126BFF]/30 dark:border-[#00A8FF]/40 text-[#126BFF] dark:text-[#00A8FF] text-xs font-black uppercase tracking-wider shadow-xs backdrop-blur-md">
                  <Stethoscope className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF]" />
                  <span>AI-POWERED HEALTHCARE DIGITAL GROWTH</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black text-[#101828] dark:text-white tracking-tight leading-[1.12]">
                  Your Medical Expertise. <br />
                  <span className="bg-gradient-to-r from-[#7047FF] via-[#126BFF] to-[#00A8FF] dark:from-[#9D7BFF] dark:via-[#38BDF8] dark:to-[#00D2FF] bg-clip-text text-transparent">
                    Our Digital Intelligence.
                  </span>
                </h1>

                {/* Supporting Copy */}
                <p className="text-base sm:text-lg text-[#475467] dark:text-[#94A3B8] max-w-2xl leading-relaxed">
                  We help doctors and healthcare brands build stronger online visibility through Google Ads, Meta campaigns, SEO, premium websites, creative content and AI-powered marketing systems.
                </p>

                {/* Clinical Trust Points */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm font-bold text-[#1E293B] dark:text-slate-200">
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-[#0E1A30]/80 backdrop-blur-md p-2.5 rounded-xl border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs">
                    <BadgeCheck className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                    <span>100% NMC & MCI Ethical Compliance</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-[#0E1A30]/80 backdrop-blur-md p-2.5 rounded-xl border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0" />
                    <span>Target High-Value Surgical Procedures</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-[#0E1A30]/80 backdrop-blur-md p-2.5 rounded-xl border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs">
                    <MapPin className="w-4 h-4 text-[#EA580C] dark:text-[#FB923C] flex-shrink-0" />
                    <span>Rank Top-3 on Google Maps in 45 Days</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/90 dark:bg-[#0E1A30]/80 backdrop-blur-md p-2.5 rounded-xl border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs">
                    <MessageSquare className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                    <span>Automated WhatsApp Pre-Screening</span>
                  </div>
                </div>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-3">
                  <button
                    onClick={() => handleOpenAuditModal()}
                    className="px-7 py-3.5 rounded-xl font-black text-sm text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
                  >
                    <span>Get Your Free Growth Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <a
                    href="#doctor-portfolio"
                    className="px-6 py-3.5 rounded-xl font-bold text-sm text-[#101828] dark:text-white bg-white/90 dark:bg-[#0E1A30]/90 hover:bg-slate-50 dark:hover:bg-[#132240] border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs transition-all flex items-center gap-2 backdrop-blur-md"
                  >
                    <span>Explore Our Work</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </a>

                  <a
                    href="https://wa.me/918725072730?text=Hello%20Digiexplode%20AI,%20I%20would%20like%20to%20discuss%20digital%20marketing%20for%20my%20medical%20practice."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3.5 rounded-xl font-bold text-sm text-white bg-[#10B981] hover:bg-[#059669] shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Doctor WhatsApp Desk</span>
                  </a>
                </div>

                {/* Confidentiality & Direct Contact Note */}
                <div className="flex items-center gap-3 pt-1 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  <span className="flex items-center gap-1 text-[#10B981]">
                    <ShieldCheck className="w-4 h-4" /> Confidential Medical Growth Consultations
                  </span>
                  <span>•</span>
                  <a href="tel:+918725072730" className="text-[#126BFF] dark:text-[#00A8FF] hover:underline flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> +91 8725072730
                  </a>
                </div>

              </div>

              {/* Right Column: Layered Healthcare Marketing Ecosystem Card Stack */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  
                  {/* Subtle Glow Backdrop */}
                  <div className="absolute -inset-2 bg-gradient-to-tr from-[#7047FF]/25 via-[#126BFF]/25 to-[#00A8FF]/25 dark:from-[#7047FF]/40 dark:via-[#00A8FF]/30 dark:to-[#10B981]/25 rounded-3xl blur-2xl opacity-80" />

                  {/* Layer 1: Main Doctor Authority Showcase */}
                  <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-[#0D182E] border-2 border-white dark:border-[#1E2D4A] shadow-2xl">
                    <img
                      src="/images/doctor-hero-male.jpg"
                      alt="Senior Doctor in Clinic — DigiExplode AI Healthcare Partner"
                      className="w-full h-[470px] object-cover object-top"
                    />

                    {/* Gradient Overlay for bottom text legibility */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07182C] via-[#07182C]/70 to-transparent p-6 text-white text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00A8FF]">
                          CLINICALLY VERIFIED SYSTEMS
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white leading-tight">
                        Built for Doctors Who Demand Clinical Authority
                      </h3>
                      <p className="text-xs text-slate-200 mt-1">
                        Scaling 35+ prestigious medical practices from North India to metro healthcare hubs.
                      </p>
                    </div>

                    {/* Layer 2: Floating Patient Trust Badge */}
                    <div className="absolute top-4 left-4 bg-white/95 dark:bg-[#0E1A30]/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 dark:border-[#1E2D4A] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient Trust</p>
                        <p className="text-xs font-black text-slate-900 dark:text-white">4.9 ★★★★★ (1.2k+ Reviews)</p>
                      </div>
                    </div>

                    {/* Layer 3: Floating Google Maps Top-3 Badge */}
                    <div className="absolute top-18 right-4 bg-white/95 dark:bg-[#0E1A30]/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-slate-200/80 dark:border-[#1E2D4A] flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-700/50 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF]" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Google Maps</p>
                        <p className="text-xs font-black text-[#126BFF] dark:text-[#00A8FF]">Rank #1 in Tricity / NCR</p>
                      </div>
                    </div>

                  </div>

                  {/* Layer 4: Simulated Live Google Search Ad & Patient Inflow Card (Floating Offset) */}
                  <div className="mt-4 p-4 rounded-2xl bg-white/95 dark:bg-[#0D182E]/95 border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xl text-left backdrop-blur-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Google Search Ad Preview
                        </span>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> High-Intent Procedure
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">Live Simulation</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0A1326] border border-slate-200/80 dark:border-[#1E2D4A]">
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        Query: "Robotic Knee Replacement Surgeon Near Me"
                      </p>
                      <h4 className="text-xs sm:text-sm font-black text-[#126BFF] dark:text-[#00A8FF] hover:underline cursor-pointer">
                        Dr. Anupam Jindal • Senior Consultant • PGI Alumnus
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                        Minimally invasive joint & spine surgery with sub-24hr recovery. 100% transparent consultation timings & clinic directions.
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-[#126BFF] dark:text-[#38BDF8]">
                        <span>✓ Book OPD Visit</span>
                        <span>✓ Google Maps Route</span>
                        <span>✓ 4.9★ Patient Rating</span>
                      </div>
                    </div>

                    {/* Live notification pill */}
                    <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Recent Inflow: Robotic Arthroscopy Inquiry (WhatsApp Desk)</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">2m ago</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 02: TRUST & SCALE STRIP ─────────────────────────── */}
        <section className="py-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            
            <div className="text-center mb-6">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Built for the Digital Demands of Modern Healthcare.
              </p>
            </div>

            {/* Channels Strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-8">
              {[
                'Google Ads',
                'Meta Advertising',
                'Healthcare SEO',
                'AI Search Optimization',
                'Website Development',
                'Creative Production'
              ].map((channel, i) => (
                <span
                  key={i}
                  className="px-3.5 py-1.5 rounded-full bg-[#F5F8FF] dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] text-xs font-bold text-slate-700 dark:text-slate-300 shadow-2xs"
                >
                  {channel}
                </span>
              ))}
            </div>

            {/* Verified Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 border-r last:border-r-0 border-slate-100 dark:border-slate-800">
                <p className="text-3xl sm:text-4xl font-black text-[#126BFF] dark:text-[#00A8FF] tracking-tight">35+</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-1">Specialist Doctors & Clinics</p>
              </div>

              <div className="p-3 border-r last:border-r-0 border-slate-100 dark:border-slate-800">
                <p className="text-3xl sm:text-4xl font-black text-[#101828] dark:text-white tracking-tight">₹180 - ₹350</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-1">Avg Cost Per Qualified Patient</p>
              </div>

              <div className="p-3 border-r last:border-r-0 border-slate-100 dark:border-slate-800">
                <p className="text-3xl sm:text-4xl font-black text-[#10B981] tracking-tight">14,000+</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-1">OPD Consultations Driven</p>
              </div>

              <div className="p-3">
                <p className="text-3xl sm:text-4xl font-black text-[#7047FF] dark:text-[#9D7BFF] tracking-tight">30 - 45 Days</p>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-1">To Google Maps Top-3 Ranking</p>
              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 03: ONE CONNECTED GROWTH ECOSYSTEM (Interactive Patient Journey) ─── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#EDF4FF]/50 dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                DIGITAL PATIENT ACQUISITION JOURNEY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                One Connected Ecosystem for Digital Growth.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Every digital interaction matters. We connect visibility, engagement, enquiries and performance measurement into one coordinated marketing strategy.
              </p>
            </div>

            {/* Interactive Stage Navigator */}
            <div className="flex items-center justify-start md:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
              {ECOSYSTEM_STAGES.map((st, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveJourneyStage(idx)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer border ${
                    activeJourneyStage === idx
                      ? 'bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] border-[#126BFF] dark:border-[#00A8FF] shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-[#0E1A30] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1E2D4A] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                    activeJourneyStage === idx ? 'bg-white text-[#126BFF] dark:bg-[#07101E] dark:text-[#00A8FF]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {st.stage}
                  </span>
                  <span>{st.title}</span>
                </button>
              ))}
            </div>

            {/* Active Journey Stage Card */}
            {(() => {
              const activeSt = ECOSYSTEM_STAGES[activeJourneyStage];
              return (
                <div className="p-8 sm:p-10 rounded-3xl bg-white/95 dark:bg-[#0D182E]/95 border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xl text-left backdrop-blur-md">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    
                    <div className="lg:col-span-8 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[#126BFF] dark:text-[#00A8FF] text-xs font-black">
                          STAGE {activeSt.stage} OF 07
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          {activeSt.tag}
                        </span>
                      </div>

                      <h3 className="text-2xl sm:text-3xl font-black text-[#101828] dark:text-white">
                        {activeSt.title} — {activeSt.subtitle}
                      </h3>

                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeSt.desc}
                      </p>

                      <div className="p-4 rounded-2xl bg-[#F5F8FF] dark:bg-[#0A1326] border border-blue-100 dark:border-[#1E2D4A] text-xs text-slate-800 dark:text-slate-200 space-y-1">
                        <span className="font-extrabold text-[#126BFF] dark:text-[#00A8FF] block uppercase tracking-wider text-[11px]">
                          What DigiExplode AI Builds In This Stage:
                        </span>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">{activeSt.deliverable}</p>
                      </div>
                    </div>

                    <div className="lg:col-span-4 bg-gradient-to-br from-[#F5F8FF] to-white dark:from-[#0A1326] dark:to-[#0D182E] p-6 rounded-2xl border border-blue-200/80 dark:border-[#1E2D4A] space-y-4 text-center">
                      <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A30] border border-slate-200 dark:border-[#1E2D4A] shadow-xs">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verified Milestone</p>
                        <p className="text-xl font-black text-[#10B981] mt-1">{activeSt.metric}</p>
                      </div>

                      <button
                        onClick={() => handleOpenAuditModal()}
                        className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Audit Your Patient Journey</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })()}

          </div>
        </section>

        {/* ─── SECTION 04: SERVICES BENTO GRID (9 Specialized Services) ─── */}
        <section id="doctor-services" className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                COMPLETE HEALTHCARE MARKETING STACK
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Everything Your Practice Needs to Grow Digitally.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Engineered strictly for private clinics, super-specialists, and hospital departments across India.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SERVICES_BENTO.map((srv) => {
                const IconComponent = srv.icon;
                return (
                  <div
                    key={srv.id}
                    className="p-7 rounded-3xl bg-[#F5F8FF] dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] hover:border-[#126BFF] dark:hover:border-[#00A8FF] hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: `${srv.color}18`, color: srv.color }}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white dark:bg-[#122442] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {srv.badge}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-[#101828] dark:text-white mb-2 group-hover:text-[#126BFF] dark:group-hover:text-[#00A8FF] transition-colors">
                        {srv.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                        {srv.desc}
                      </p>

                      <ul className="space-y-2 mb-6">
                        {srv.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleOpenAuditModal()}
                      className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-extrabold text-[#126BFF] dark:text-[#00A8FF] flex items-center gap-1.5 hover:gap-2.5 transition-all cursor-pointer"
                    >
                      <span>Request {srv.title} Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── SECTION 05: SPECIALTY MARKETING EXPLORER (13 Specialties) ─── */}
        <section id="specialties-explorer" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8FF] dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                CUSTOMIZED BY CLINICAL DOMAIN
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Your Specialty Is Unique. Your Marketing Strategy Should Be Too.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Every medical domain has distinct patient psychology and procedure economics. Explore our specialized blueprints:
              </p>
            </div>

            {/* Specialty Selector Tabs */}
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
                        ? 'bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] border-[#126BFF] dark:border-[#00A8FF] shadow-md shadow-blue-500/20'
                        : 'bg-white dark:bg-[#0D182E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1E2D4A] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Specialty Detail Card */}
            <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xl text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[#126BFF] dark:text-[#00A8FF] text-xs font-black">
                    <activeSpec.icon className="w-4 h-4" />
                    <span>{activeSpec.category} Strategy</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-[#101828] dark:text-white">
                    {activeSpec.name} Patient Growth Funnel
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeSpec.strategySnippet}
                  </p>

                  {/* Focus Procedures */}
                  <div className="pt-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2">
                      High-Yield Procedures We Focus On:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeSpec.focusProcedures.map((proc, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#126BFF] dark:text-[#00A8FF]" />
                          {proc}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Primary Channels */}
                  <div className="pt-2">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-2">
                      Recommended Channel Mix:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeSpec.channels.map((chan, idx) => (
                        <span key={idx} className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-[11px] font-bold text-[#126BFF] dark:text-[#00A8FF] border border-blue-100 dark:border-blue-800/40">
                          {chan}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sample Content */}
                  <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 font-semibold">
                    <span className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400 block mb-0.5">
                      Sample Educational Hook:
                    </span>
                    {activeSpec.sampleContent}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-gradient-to-br from-[#F5F8FF] to-white dark:from-[#0A1326] dark:to-[#0D182E] p-6 rounded-2xl border border-blue-200/80 dark:border-[#1E2D4A] space-y-4">
                  <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A30] border border-slate-200 dark:border-[#1E2D4A] shadow-xs text-center">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expected Patient Growth</p>
                    <p className="text-xl font-black text-[#10B981] mt-0.5">{activeSpec.expectedOpdBoost}</p>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-[#0E1A30] border border-slate-200 dark:border-[#1E2D4A] shadow-xs text-center">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Cost Per Confirmed Booking</p>
                    <p className="text-xl font-black text-[#126BFF] dark:text-[#00A8FF] mt-0.5">{activeSpec.avgCostPerBooking}</p>
                  </div>

                  <button
                    onClick={() => handleOpenAuditModal(activeSpec.name)}
                    className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <span>Request {activeSpec.name} Blueprint</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[10px] text-center text-slate-400 font-medium">
                    * No guaranteed medical outcomes. Strictly ethical procedure marketing under NMC guidelines.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 06: CLINICAL DIAGNOSIS (Generic Agency vs DigiExplode AI) ─── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-6xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                CLINICAL DIAGNOSIS
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Why Generic Marketing Agencies Fail Doctors
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-3">
                General digital agencies treat a super-specialist surgeon like an e-commerce t-shirt store. Healthcare demands medical terminology accuracy, clinical empathy, and strict NMC ethical compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              
              {/* Card 1: Generic Agencies */}
              <div className="p-8 rounded-3xl bg-white dark:bg-[#130E17] border border-rose-200/80 dark:border-rose-900/60 shadow-sm text-left">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center text-rose-600">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">The Generic Agency Approach</h3>
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">Unethical, Ineffective & High Risk</p>
                  </div>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Run discount promos</strong> ("50% off consultation") attracting non-paying price hunters and degrading your clinical prestige.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Violate NMC / MCI advertising guidelines</strong> with exaggerated claims, putting your medical council registration at risk.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Waste budgets on irrelevant queries</strong> because they don't understand the difference between minor OPD symptoms and surgical indications.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-500 font-black mt-0.5">✕</span>
                    <span><strong>Massive clinic no-show rate</strong> because inquiries are not pre-qualified with consultation fees and driving map pins.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: DigiExplode AI Healthcare Partner */}
              <div className="p-8 rounded-3xl bg-white dark:bg-[#0D182E] border-2 border-[#126BFF] dark:border-[#00A8FF] shadow-xl text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                  The Clinical Gold Standard
                </div>

                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-[#126BFF] dark:text-[#00A8FF]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#101828] dark:text-white">DigiExplode AI Healthcare Partner</h3>
                    <p className="text-xs text-[#126BFF] dark:text-[#00A8FF] font-bold">Scientific, Ethical & Procedure-Focused</p>
                  </div>
                </div>

                <ul className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span><strong>Procedure-Intent Targeting:</strong> We target patients specifically searching for surgical procedures (Knee replacement, IVF, Lasik, Hair PRP, Implants).</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span><strong>100% NMC Compliant:</strong> Strictly educational, scientific, and patient-first branding that elevates your professional reputation.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span><strong>Google Maps Top-3 Domination:</strong> Hyper-local SEO positioning your clinic at the absolute top of local map searches.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                    <span><strong>Automated WhatsApp Pre-Screening:</strong> Every inquiry receives clinic timings, doctor credentials, and consultation fees before booking.</span>
                  </li>
                </ul>
              </div>

            </div>

          </div>
        </section>

        {/* ─── SECTION 07: REAL DOCTOR PORTFOLIO & CASE STUDIES ────────── */}
        <section id="doctor-portfolio" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8FF] dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                AUTHENTIC PRACTICE RESULTS
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Real Creative Work. Real Healthcare Brands.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Showcasing the breadth and clinical quality of DigiExplode AI's authentic medical marketing partnerships across India.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {[
                { id: 'all', label: 'All Case Studies' },
                { id: 'websites', label: 'Medical Websites' },
                { id: 'branding', label: 'Doctor Branding' },
                { id: 'reels', label: 'Educational Reels' },
                { id: 'ads', label: 'Search Advertising' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActivePortfolioTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    activePortfolioTab === tab.id
                      ? 'bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] border-[#126BFF] dark:border-[#00A8FF] shadow-xs'
                      : 'bg-white dark:bg-[#0D182E] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#1E2D4A] hover:bg-slate-50 dark:hover:bg-[#132240]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Case Studies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {CASE_STUDIES.map((cs, i) => (
                <div
                  key={i}
                  className="p-7 rounded-3xl bg-white dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] hover:border-[#126BFF] dark:hover:border-[#00A8FF] hover:shadow-xl transition-all duration-300 text-left flex flex-col justify-between"
                >
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[#126BFF] dark:text-[#00A8FF] text-[10px] font-black uppercase tracking-wider mb-4">
                      {cs.tag}
                    </span>
                    <h3 className="text-lg font-black text-[#101828] dark:text-white">{cs.doctor}</h3>
                    <p className="text-xs text-[#126BFF] dark:text-[#38BDF8] font-bold mt-0.5">{cs.credentials}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cs.clinic}</p>

                    <div className="grid grid-cols-3 gap-2 my-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                      {cs.metrics.map((m, idx) => (
                        <div key={idx} className="p-2 rounded-xl bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-200 dark:border-slate-700">
                          <p className="text-sm sm:text-base font-black text-[#126BFF] dark:text-[#00A8FF]">{m.value}</p>
                          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase mt-0.5">{m.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-6">
                      <p><strong>Challenge:</strong> {cs.challenge}</p>
                      <p><strong>Strategy:</strong> {cs.solution}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {cs.deliverables.map((d, dIdx) => (
                        <span key={dIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#126BFF] dark:text-[#00A8FF]">
                    <span>Verified Growth Partner</span>
                    <BadgeCheck className="w-4 h-4 text-[#10B981]" />
                  </div>
                </div>
              ))}
            </div>

            {/* Before-and-After Clinic Transformation Comparison */}
            <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#07182C] via-[#0E2A47] to-[#126BFF] text-white text-left shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#00A8FF]">
                    CLINICAL BENCHMARK COMPARISON
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">
                    Before DigiExplode AI vs After DigiExplode AI
                  </h3>
                </div>

                <div className="flex items-center gap-2 bg-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setShowBeforeAfter(true)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      showBeforeAfter ? 'bg-white text-[#07182C] shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Side-By-Side Comparison
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Traditional State */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-3">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Traditional Practice Model
                  </span>
                  <h4 className="text-lg font-bold text-slate-200">Sporadic Footfall & High Uncertainty</h4>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span>Buried on page 2 or 3 of Google Maps for local doctor searches.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span>Reliance on third-party aggregators charging heavy commission per booking.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span>No-shows reach 25% due to lack of pre-appointment WhatsApp confirmation.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">✕</span>
                      <span>Doctor spends valuable clinical time answering administrative inquiries.</span>
                    </li>
                  </ul>
                </div>

                {/* DigiExplode AI State */}
                <div className="p-6 rounded-2xl bg-white/10 border border-[#00A8FF]/40 backdrop-blur-md space-y-3">
                  <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    DigiExplode AI Growth Engine
                  </span>
                  <h4 className="text-lg font-bold text-white">Consistent High-Intent Surgical Bookings</h4>
                  <ul className="space-y-2.5 text-xs text-slate-100">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span>Locked in Google Maps Top-3 local pack across high-value residential pincodes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span>Direct patient relationships with 100% practice ownership of all lead data.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span>No-shows plunge under 4% via automated WhatsApp reminders and directions.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                      <span>Doctor dedicates just 45 minutes bi-weekly; our team executes everything.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={() => handleOpenAuditModal()}
                  className="px-8 py-4 rounded-xl font-black text-sm text-[#07182C] bg-white hover:bg-slate-100 shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Transform Your Practice Today</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* ─── SECTION 08: INTERACTIVE SAAS-STYLE MARKETING INTELLIGENCE DASHBOARD ─── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                PRACTICE INTELLIGENCE DASHBOARD
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Know What's Working. Understand What Matters.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Full visibility into qualified inquiries, procedure economics, and OPD conversion. Every campaign metric tracked with clinical precision.
              </p>
            </div>

            {/* Dashboard Container */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#07182C] text-white border border-slate-800 shadow-2xl text-left">
              
              {/* Dashboard Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-[#00A8FF]">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">Live Clinical Marketing Analytics</h3>
                    <p className="text-[11px] text-slate-400">Illustrative Demo Performance Model</p>
                  </div>
                </div>

                {/* Range and Channel Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                    {(['30d', '90d', 'all'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setAnalyticsTimeRange(r)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          analyticsTimeRange === r ? 'bg-[#126BFF] text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {r === '30d' ? '30 Days' : r === '90d' ? '90 Days' : 'All-Time'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                    {(['all', 'google', 'maps', 'meta'] as const).map(c => (
                      <button
                        key={c}
                        onClick={() => setAnalyticsChannel(c)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          analyticsChannel === c ? 'bg-[#7047FF] text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {c === 'all' ? 'All Channels' : c === 'google' ? 'Google Search' : c === 'maps' ? 'Maps SEO' : 'Meta Reels'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Website Visits</p>
                  <p className="text-2xl font-black text-white mt-1">
                    {analyticsTimeRange === '30d' ? '8,420' : analyticsTimeRange === '90d' ? '24,180' : '96,400'}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-400">↑ +38% MoM Growth</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Qualified Enquiries</p>
                  <p className="text-2xl font-black text-[#00A8FF] mt-1">
                    {analyticsTimeRange === '30d' ? '348' : analyticsTimeRange === '90d' ? '1,024' : '4,190'}
                  </p>
                  <span className="text-[10px] font-bold text-emerald-400">↑ 18.2% Conversion</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Avg Cost Per Booking</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">
                    {analyticsChannel === 'maps' ? '₹0 (Organic)' : '₹240'}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400">Verified Patient Inflow</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">OPD Attendance Rate</p>
                  <p className="text-2xl font-black text-[#7047FF] mt-1">96.4%</p>
                  <span className="text-[10px] font-bold text-emerald-400">WhatsApp Reminders Active</span>
                </div>
              </div>

              {/* Visual Funnel Breakdown */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
                <p className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4">
                  Patient Acquisition Conversion Funnel
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">1. Search Ad & Maps Impressions</span>
                      <span className="text-slate-400">100% (64,200 Imp)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-[#126BFF] rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">2. Highly Targeted Website Visitors</span>
                      <span className="text-slate-400">13.1% (8,420 Visits)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#126BFF] to-[#00A8FF] rounded-full" style={{ width: '65%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">3. Direct Phone Calls & WhatsApp Inquiries</span>
                      <span className="text-slate-400">4.1% (348 Inquiries)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00A8FF] to-emerald-400 rounded-full" style={{ width: '38%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">4. Confirmed Clinic Consultation Footfall</span>
                      <span className="text-slate-400">3.9% (335 Arrived OPD Patients)</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981] rounded-full" style={{ width: '28%' }} />
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ─── SECTION 09: PRACTICE REVENUE & OPD UPSIDE SIMULATOR ─────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8FF] dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-5xl mx-auto">
            
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                PRACTICE REVENUE SIMULATOR
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Calculate Your Practice Growth Potential
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Estimate your monthly and annual revenue upside with our dedicated medical marketing engine.
              </p>
            </div>

            <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#0D182E] border-2 border-slate-200/90 dark:border-[#1E2D4A] shadow-xl text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                
                {/* Sliders */}
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Current Monthly OPD Patients
                      </label>
                      <span className="text-lg font-black text-[#126BFF] dark:text-[#00A8FF]">{monthlyOpdSlider} Patients</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={400}
                      step={10}
                      value={monthlyOpdSlider}
                      onChange={e => setMonthlyOpdSlider(Number(e.target.value))}
                      className="w-full accent-[#126BFF] dark:accent-[#00A8FF] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                      <span>40 / mo</span>
                      <span>400 / mo</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Doctor Consultation Fee
                      </label>
                      <span className="text-lg font-black text-[#10B981]">₹{consultFeeSlider}</span>
                    </div>
                    <input
                      type="range"
                      min={400}
                      max={2500}
                      step={100}
                      value={consultFeeSlider}
                      onChange={e => setConsultFeeSlider(Number(e.target.value))}
                      className="w-full accent-[#10B981] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                      <span>₹400</span>
                      <span>₹2,500</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-200 dark:border-slate-800 pt-3">
                    * Projections exclude high-ticket surgical procedure revenues, in-clinic diagnostics, and long-term patient family referrals, which typically represent 3x to 5x higher value.
                  </p>
                </div>

                {/* Calculation Outputs */}
                <div className="p-6 rounded-2xl bg-[#F5F8FF] dark:bg-[#0A1326] border border-blue-100 dark:border-[#1E2D4A] shadow-md space-y-4">
                  <div className="text-center p-4 rounded-xl bg-white dark:bg-[#0E1A30] border border-blue-200 dark:border-[#1E2D4A]">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Projected Extra Inflow
                    </p>
                    <p className="text-3xl font-black text-[#126BFF] dark:text-[#00A8FF] mt-1">
                      +{projectedExtraPatients} Patients / Mo
                    </p>
                    <p className="text-[11px] text-[#0E55CC] dark:text-[#38BDF8] font-semibold mt-0.5">
                      Nearly doubling your current clinic patient footfall
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-white dark:bg-[#0E1A30] border border-slate-200 dark:border-[#1E2D4A]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Monthly OPD Upside</p>
                      <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                        +₹{projectedExtraRevenue.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Annual Revenue Boost</p>
                      <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                        +₹{annualRevenueUpside}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAuditModal()}
                    className="w-full py-3.5 rounded-xl font-black text-xs text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>Claim Your Growth Audit</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 10: ZERO-TIME COMMITMENT PROTOCOL (Doctor in Clinic) ─── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div className="relative rounded-3xl overflow-hidden border-2 border-white dark:border-[#1E2D4A] shadow-2xl bg-white dark:bg-[#0D182E]">
                  <img
                    src="/images/doctor-consultation-female.jpg"
                    alt="Doctor in consultation room — DigiExplode AI Client Success"
                    className="w-full h-[420px] object-cover"
                  />
                  <div className="p-5 bg-white dark:bg-[#0D182E] border-t border-slate-100 dark:border-slate-800 text-left">
                    <p className="text-sm font-black text-[#101828] dark:text-white">"Only 45 Minutes of My Time Every Fortnight"</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      DigiExplode AI prepares clinical scripts, structures procedure topics, and edits all medical videos seamlessly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2 text-left space-y-4">
                <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF]">
                  DESIGNED FOR BUSY SURGEONS & SPECIALISTS
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white leading-tight">
                  You Focus On Healing Patients. <br />
                  We Handle The Entire Growth Engine.
                </h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  We know your time is sacred. You shouldn't be fiddling with video editors, ad accounts, or social media algorithms between surgeries. We operate as your dedicated healthcare marketing department.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <div className="p-3 bg-[#F5F8FF] dark:bg-[#0D182E] rounded-xl border border-slate-200 dark:border-[#1E2D4A] flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0 mt-0.5" />
                    <span>Done-For-You Medical Video Scripts</span>
                  </div>
                  <div className="p-3 bg-[#F5F8FF] dark:bg-[#0D182E] rounded-xl border border-slate-200 dark:border-[#1E2D4A] flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0 mt-0.5" />
                    <span>NMC Compliance Checked Before Publishing</span>
                  </div>
                  <div className="p-3 bg-[#F5F8FF] dark:bg-[#0D182E] rounded-xl border border-slate-200 dark:border-[#1E2D4A] flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0 mt-0.5" />
                    <span>Google Reviews & Reputation Defense</span>
                  </div>
                  <div className="p-3 bg-[#F5F8FF] dark:bg-[#0D182E] rounded-xl border border-slate-200 dark:border-[#1E2D4A] flex items-start gap-2 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0 mt-0.5" />
                    <span>Dedicated Healthcare Growth Manager</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => handleOpenAuditModal()}
                    className="px-6 py-3.5 rounded-xl font-bold text-xs text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Schedule Practice Walkthrough</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ─── SECTION 11: 5-STAGE PRACTICE GROWTH PROCESS ─────────────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8FF] dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                STRUCTURED EXECUTION ROADMAP
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                A Smarter Process. A Clearer Direction.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                How we take a private clinic or hospital department from sporadic walk-ins to a consistently booked surgical and OPD schedule.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-left">
              {[
                {
                  number: '01',
                  title: 'Discover',
                  desc: 'In-depth clinical audit of your procedure margins, catchment radius, Google Maps position, and local competitors.'
                },
                {
                  number: '02',
                  title: 'Strategize',
                  desc: 'Curate the exact combination of Google search procedure keywords, high-income pincodes, and video scripts.'
                },
                {
                  number: '03',
                  title: 'Create',
                  desc: 'Produce high-converting medical landing pages, doctor introduction videos, and automated WhatsApp appointment funnels.'
                },
                {
                  number: '04',
                  title: 'Launch',
                  desc: 'Deploy targeted campaigns with conversion tracking, call recording, and instant reception routing.'
                },
                {
                  number: '05',
                  title: 'Optimize',
                  desc: 'Bi-weekly analysis shifting budget to highest-margin procedures and building unstoppable local Google authority.'
                }
              ].map((step, i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-white dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] hover:border-[#126BFF] dark:hover:border-[#00A8FF] hover:shadow-lg transition-all duration-300 relative group"
                >
                  <span className="text-3xl font-black text-slate-200 dark:text-slate-700 group-hover:text-[#126BFF] dark:group-hover:text-[#00A8FF] transition-colors block mb-2">
                    {step.number}
                  </span>
                  <h3 className="text-base font-black text-[#101828] dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── SECTION 12: CONFIDENTIAL DOCTOR GROWTH AUDIT SECTION (FORM) ─── */}
        <section id="doctor-audit-form" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-[#EDF4FF] dark:from-[#091326] dark:to-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-4xl mx-auto text-center">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EDF4FF] dark:bg-[#122442] border border-[#126BFF]/30 dark:border-[#00A8FF]/40 text-[#126BFF] dark:text-[#00A8FF] text-xs font-black uppercase tracking-wider mb-4">
              <Stethoscope className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF]" />
              <span>CONFIDENTIAL PRACTICE AUDIT</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white tracking-tight">
              Discover Your Next Digital Growth Opportunity.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto">
              Request a complimentary review of your digital presence and identify exact surgical and OPD keyword opportunities in your city.
            </p>

            {/* Audit Categories Checklist Strip */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 my-6">
              {[
                'Website Experience',
                'Search Visibility',
                'Google Maps Ranking',
                'Social Presence',
                'Advertising Opportunities',
                'Enquiry Conversion',
                'NMC Compliance Review'
              ].map((cat, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-white dark:bg-[#0D182E] border border-slate-200 dark:border-[#1E2D4A] text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>{cat}</span>
                </span>
              ))}
            </div>

            <div className="mt-8 p-8 sm:p-10 rounded-3xl bg-white dark:bg-[#0D182E] border-2 border-[#126BFF]/25 dark:border-[#00A8FF]/30 shadow-2xl text-left">
              
              {formSubmitted ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    Audit Request Received, Doctor.
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                    Our Senior Healthcare Growth Strategist has received your details and will prepare a confidential practice roadmap. We have also opened a WhatsApp confirmation.
                  </p>
                  <div className="pt-4 flex flex-wrap justify-center gap-3">
                    <a
                      href="https://wa.me/918725072730?text=Hello%20Digiexplode%20AI,%20I%20would%20like%20to%20discuss%20digital%20marketing%20for%20my%20medical%20practice."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-black text-xs flex items-center gap-2 shadow-md transition-all"
                    >
                      <MessageSquare className="w-4 h-4" /> Message Direct Desk (+91 8725072730)
                    </a>
                    <button
                      onClick={() => setFormSubmitted(false)}
                      className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-5">
                  
                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Doctor / Clinic Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Dr. Vikram Sharma"
                        value={docName}
                        onChange={e => setDocName(e.target.value)}
                        className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Medical Specialty *
                      </label>
                      <select
                        value={docSpecialty}
                        onChange={e => setDocSpecialty(e.target.value)}
                        className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all cursor-pointer"
                      >
                        {SPECIALTIES.map(s => (
                          <option key={s.id} value={s.name} className="dark:bg-[#0A1326] dark:text-white">
                            {s.name}
                          </option>
                        ))}
                        <option value="Multi-Specialty Hospital" className="dark:bg-[#0A1326] dark:text-white">Multi-Specialty Hospital</option>
                        <option value="General Surgery" className="dark:bg-[#0A1326] dark:text-white">General Surgery</option>
                        <option value="Pediatrics" className="dark:bg-[#0A1326] dark:text-white">Pediatrics & Neonatology</option>
                        <option value="Other Medical Specialty" className="dark:bg-[#0A1326] dark:text-white">Other Medical Specialty</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Clinic / Hospital City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Chandigarh, Gurugram, Delhi..."
                        value={clinicCity}
                        onChange={e => setClinicCity(e.target.value)}
                        className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        WhatsApp / Contact Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={docPhone}
                        onChange={e => setDocPhone(e.target.value)}
                        className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                      />
                    </div>
                  </div>

                  {/* Multi-select Services */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Growth Services You Are Interested In:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        'Google Ads & Patient Inflow',
                        'Google Maps Top-3 Ranking',
                        'Doctor Video Reels & Branding',
                        'High-Converting Clinic Website',
                        'WhatsApp Pre-Screening Automation',
                        'Full Practice Marketing Retainer'
                      ].map((item, idx) => {
                        const isChecked = selectedServiceInterests.includes(item);
                        return (
                          <label
                            key={idx}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-[#126BFF] dark:border-[#00A8FF] text-[#126BFF] dark:text-[#00A8FF] font-bold'
                                : 'bg-slate-50 dark:bg-[#0A1326] border-slate-200 dark:border-[#1E2D4A] text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedServiceInterests(selectedServiceInterests.filter(s => s !== item));
                                } else {
                                  setSelectedServiceInterests([...selectedServiceInterests, item]);
                                }
                              }}
                              className="accent-[#126BFF] dark:accent-[#00A8FF] rounded"
                            />
                            <span>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 mt-2 rounded-xl font-black text-sm text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Securing Doctor Slot...' : 'Request My Free Growth Audit'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-[#10B981]">
                      <ShieldCheck className="w-3.5 h-3.5" /> 100% Confidential
                    </span>
                    <span>•</span>
                    <span>Zero Obligation</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold text-[#126BFF] dark:text-[#00A8FF]">
                      <Phone className="w-3.5 h-3.5" /> Direct: +91 8725072730
                    </span>
                  </div>

                </form>
              )}

            </div>

            {/* Direct Contacts Row */}
            <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>Prefer direct conversation with our healthcare division head?</p>
              <div className="flex items-center justify-center gap-6 pt-2 font-bold flex-wrap">
                <a href="tel:+918725072730" className="text-[#126BFF] dark:text-[#00A8FF] hover:underline flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> +91 8725072730
                </a>
                <span>|</span>
                <a
                  href="https://wa.me/918725072730?text=Hello%20Digiexplode%20AI,%20I%20would%20like%20to%20discuss%20digital%20marketing%20for%20my%20medical%20practice."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#10B981] hover:underline flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Doctor Desk
                </a>
                <span>|</span>
                <a href="mailto:digiexploadai@gmail.com" className="text-slate-600 dark:text-slate-400 hover:underline">
                  digiexploadai@gmail.com
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* ─── SECTION 13: CLINICAL INSIGHTS & EDITORIAL ARTICLES ──────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#091326] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-7xl mx-auto">
            
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                HEALTHCARE INTELLIGENCE
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Insights for Healthcare's Digital Future.
              </h2>
              <p className="text-sm sm:text-base text-[#475467] dark:text-[#94A3B8] mt-3">
                Research, technical frameworks, and ethical case studies authored for Indian doctors and healthcare leaders.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              {INSIGHTS_ARTICLES.map(art => (
                <div
                  key={art.id}
                  className="p-6 rounded-3xl bg-[#F5F8FF] dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] hover:border-[#126BFF] dark:hover:border-[#00A8FF] hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#122442] text-[#126BFF] dark:text-[#00A8FF] border border-blue-100 dark:border-blue-900/40">
                        {art.category}
                      </span>
                      <span>{art.readTime}</span>
                    </div>

                    <h3 className="text-base font-black text-[#101828] dark:text-white group-hover:text-[#126BFF] dark:group-hover:text-[#00A8FF] transition-colors leading-snug mb-2">
                      {art.title}
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                      {art.snippet}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    <span>{art.author}</span>
                    <button
                      onClick={() => handleOpenAuditModal()}
                      className="text-[#126BFF] dark:text-[#00A8FF] font-black hover:underline cursor-pointer flex items-center gap-1"
                    >
                      Read Guide <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ─── SECTION 14: FREQUENTLY ASKED QUESTIONS (Accordion) ───────── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F5F8FF] dark:bg-[#07101E] border-b border-[#E5EAF2] dark:border-[#1E2D4A] transition-colors duration-300">
          <div className="max-w-4xl mx-auto">
            
            <div className="text-center mb-12">
              <span className="text-xs font-black uppercase tracking-widest text-[#126BFF] dark:text-[#00A8FF] block mb-2">
                CLINICAL CLARITY & TRANSPARENCY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-[#101828] dark:text-white">
                Questions About Growing Your Medical Practice?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                Everything you need to know about ethical digital marketing for doctors across India.
              </p>
            </div>

            <div className="space-y-3.5 text-left">
              {FAQS.map((faq, i) => {
                const isOpen = openFaqIndex === i;
                return (
                  <div
                    key={i}
                    className="rounded-2xl bg-white dark:bg-[#0D182E] border border-[#E5EAF2] dark:border-[#1E2D4A] shadow-xs overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                      className="w-full p-5 text-left font-black text-sm sm:text-base text-[#101828] dark:text-white flex items-center justify-between gap-3 cursor-pointer hover:text-[#126BFF] dark:hover:text-[#00A8FF] transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <HelpCircle className="w-4 h-4 text-[#126BFF] dark:text-[#00A8FF] flex-shrink-0" />
                        <span>{faq.q}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-[#126BFF] dark:text-[#00A8FF]' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pl-11">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ─── CONTEXT-AWARE FLOATING QUICK ACTIONS ────────────────────── */}
        {/* Floating WhatsApp Consultation Button */}
        <a
          href="https://wa.me/918725072730?text=Hello%20Digiexplode%20AI,%20I%20would%20like%20to%20discuss%20digital%20marketing%20for%20my%20medical%20practice."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-[#10B981] text-white font-black text-xs shadow-2xl flex items-center gap-2 hover:bg-[#059669] transition-all transform hover:scale-105"
          aria-label="Direct Doctor WhatsApp Desk"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Doctor Desk WhatsApp</span>
        </a>

        {/* Floating Quick Audit Pill */}
        <button
          onClick={() => handleOpenAuditModal()}
          className="fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] font-black text-xs shadow-2xl flex items-center gap-2 hover:bg-[#0E55CC] dark:hover:bg-[#0090DC] transition-all transform hover:scale-105 cursor-pointer"
          aria-label="Request Free Practice Audit"
        >
          <Sparkles className="w-4 h-4 text-[#BAE6FD] dark:text-[#07101E]" />
          <span>Get Free Growth Audit</span>
        </button>

        {/* ─── DEDICATED CONSULTATION AUDIT MODAL (Intent-Driven) ───────── */}
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#07182C]/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0D182E] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#1E2D4A] overflow-hidden text-left max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-[#07182C] via-[#0F2942] to-[#126BFF] dark:from-[#050C17] dark:via-[#09152B] dark:to-[#0A2548] text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-[#00A8FF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Confidential Doctor Growth Audit</h3>
                    <p className="text-[11px] text-slate-300">Dedicated Practice Review with Senior Healthcare Strategist</p>
                  </div>
                </div>

                <button
                  onClick={handleCloseAuditModal}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4">
                {formSubmitted ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Audit Request Received, Doctor.
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                      Our Senior Healthcare Growth Strategist will contact you within 2 business hours. A WhatsApp conversation has been initiated.
                    </p>
                    <div className="pt-3 flex justify-center gap-2">
                      <button
                        onClick={handleCloseAuditModal}
                        className="px-5 py-2.5 rounded-xl bg-[#126BFF] dark:bg-[#00A8FF] text-white dark:text-[#07101E] font-bold text-xs cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    {errorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Doctor / Clinic Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Dr. Vikram Sharma"
                          value={docName}
                          onChange={e => setDocName(e.target.value)}
                          className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Medical Specialty *
                        </label>
                        <select
                          value={docSpecialty}
                          onChange={e => setDocSpecialty(e.target.value)}
                          className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all cursor-pointer"
                        >
                          {SPECIALTIES.map(s => (
                            <option key={s.id} value={s.name} className="dark:bg-[#0A1326] dark:text-white">
                              {s.name}
                            </option>
                          ))}
                          <option value="Multi-Specialty Hospital" className="dark:bg-[#0A1326] dark:text-white">Multi-Specialty Hospital</option>
                          <option value="General Surgery" className="dark:bg-[#0A1326] dark:text-white">General Surgery</option>
                          <option value="Pediatrics" className="dark:bg-[#0A1326] dark:text-white">Pediatrics & Neonatology</option>
                          <option value="Other Medical Specialty" className="dark:bg-[#0A1326] dark:text-white">Other Medical Specialty</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Clinic / Hospital City *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Chandigarh, Gurugram, Delhi..."
                          value={clinicCity}
                          onChange={e => setClinicCity(e.target.value)}
                          className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          WhatsApp / Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 98765 43210"
                          value={docPhone}
                          onChange={e => setDocPhone(e.target.value)}
                          className="w-full bg-[#F5F8FF] dark:bg-[#0A1326] border border-slate-300 dark:border-[#1E2D4A] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-[#126BFF] dark:focus:border-[#00A8FF] focus:bg-white dark:focus:bg-[#0F1E38] transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 mt-2 rounded-xl font-black text-xs text-white bg-[#126BFF] hover:bg-[#0E55CC] dark:bg-[#00A8FF] dark:hover:bg-[#0090DC] dark:text-[#07101E] shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>{isSubmitting ? 'Securing Doctor Slot...' : 'Request My Free Growth Audit'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-semibold pt-1">
                      🔒 100% Confidential. All data is strictly protected under clinical privacy standards.
                    </p>
                  </form>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default DoctorMarketingPage;
