import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Layers, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Video, 
  FileText, 
  ListPlus, 
  Eye, 
  Bookmark, 
  Building2, 
  Briefcase, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Plus, 
  Trash2, 
  Info, 
  X, 
  ChevronRight,
  Zap,
  Target
} from 'lucide-react';
import { type ClientData } from './ClientList';
import { type MasterEmployee } from '../../lib/employeeMaster';
import { type CalendarEntry } from '../../lib/calendarStorage';
import { type ParsedWorkTask } from './QuickWorkEntry';
import { ClientSelect } from './ClientSelect';

export interface RoutineDeliverableTemplate {
  title: string;
  format: 'Static Post' | 'Reel' | 'Carousel' | 'Story' | 'YouTube Short' | 'Video' | 'GMB Post' | 'Other';
  category: string;
  platforms: string[];
  dayOffset: number; // Suggested offset in days from start
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  subtasks: string[];
  estimatedHours: number;
}

export interface SmartRoutineDefinition {
  id: string;
  name: string;
  bestFor: string;
  industryMatch: string[]; // e.g. ['Healthcare', 'Medical', 'Doctor']
  packageSuitability: ('Starter' | 'Growth' | 'Premium')[];
  deliverables: RoutineDeliverableTemplate[];
  timeline: string;
  productionRequirement: 'Design only' | 'Content + Design' | 'Video + Design' | 'Video Production Heavy';
  teamDemand: 'Light' | 'Moderate' | 'Heavy';
  workflow: string[];
  description: string;
  isCustom?: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// MASTER AGENCY ROUTINES LIBRARY (10 Real-World Delivery Workflows)
// ────────────────────────────────────────────────────────────────────────────
export const MASTER_AGENCY_ROUTINES: SmartRoutineDefinition[] = [
  {
    id: 'routine_healthcare_authority',
    name: 'Healthcare Authority Week',
    bestFor: 'Doctors, hospitals, specialized clinics',
    industryMatch: ['Healthcare', 'Medical', 'Doctor', 'Neurosurgery', 'Orthopaedics', 'Gynecology', 'Cardiology', 'Dental', 'Dermatology', 'Gastroenterology', 'Pediatrics'],
    packageSuitability: ['Growth', 'Premium'],
    timeline: '7 Days (Weekly Cadence)',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'Establish clinical authority through patient education, procedure FAQ reels, and interactive health myth busters.',
    workflow: [
      'Clinical topic research',
      'Doctor hook & script outline',
      'Video production / editing',
      'Graphic design & infographics',
      'Internal medical review',
      'Client doctor sign-off',
      'Platform publishing'
    ],
    deliverables: [
      {
        title: 'Common Symptoms & When to Seek Consultation (Reel)',
        format: 'Reel',
        category: 'Video Production',
        platforms: ['Instagram', 'YouTube'],
        dayOffset: 1,
        priority: 'High',
        estimatedHours: 3,
        subtasks: ['Hook research', 'Doctor soundbite editing', 'Caption copy & disclaimer', 'Client review']
      },
      {
        title: '5 Warning Signs Every Patient Should Know (Static Infographic)',
        format: 'Static Post',
        category: 'Social Media',
        platforms: ['Instagram', 'Facebook', 'LinkedIn'],
        dayOffset: 2,
        priority: 'Medium',
        estimatedHours: 2,
        subtasks: ['Infographic visual design', 'Medical accuracy check', 'Caption & hashtags']
      },
      {
        title: 'Myths vs Facts: Procedure & Recovery FAQ (Carousel)',
        format: 'Carousel',
        category: 'Social Media',
        platforms: ['Instagram', 'Facebook'],
        dayOffset: 4,
        priority: 'High',
        estimatedHours: 2.5,
        subtasks: ['Carousel slide copy', 'Branded slide layout', 'Client approval']
      },
      {
        title: 'Modern Treatment & Surgical Advancement Breakdown (Reel)',
        format: 'Reel',
        category: 'Video Production',
        platforms: ['Instagram', 'YouTube'],
        dayOffset: 5,
        priority: 'High',
        estimatedHours: 3,
        subtasks: ['B-roll overlay', 'Motion typography', 'Client doctor review']
      },
      {
        title: 'Healthy Lifestyle & Prevention Checklist (Static Post)',
        format: 'Static Post',
        category: 'Social Media',
        platforms: ['Instagram', 'Facebook'],
        dayOffset: 6,
        priority: 'Medium',
        estimatedHours: 1.5,
        subtasks: ['Graphic layout', 'Copy & CTA']
      },
      {
        title: 'Patient Query of the Week (Reel)',
        format: 'Reel',
        category: 'Video Production',
        platforms: ['Instagram', 'YouTube'],
        dayOffset: 7,
        priority: 'Medium',
        estimatedHours: 2.5,
        subtasks: ['Q&A video cut', 'Subtitle styling', 'Publishing']
      }
    ]
  },
  {
    id: 'routine_doctor_trust_pack',
    name: 'Doctor Trust & Education Pack',
    bestFor: 'Healthcare personal brands & independent practitioners',
    industryMatch: ['Healthcare', 'Medical', 'Doctor', 'Clinic', 'Senior Healthcare'],
    packageSuitability: ['Starter', 'Growth'],
    timeline: '7 Days',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'Compact 4-item trust building pack designed for high engagement and personal connection with prospective patients.',
    workflow: ['Topic brief', 'Doctor script', 'Video edit', 'Design copy', 'Doctor approval', 'Publish'],
    deliverables: [
      {
        title: 'Expert Advice: What Most People Overlook (Reel)',
        format: 'Reel',
        category: 'Video Production',
        platforms: ['Instagram', 'YouTube'],
        dayOffset: 1,
        priority: 'High',
        estimatedHours: 3,
        subtasks: ['Video edit', 'Sound sync', 'Approval']
      },
      {
        title: 'Patient Education Guide: Steps to Recovery (Carousel)',
        format: 'Carousel',
        category: 'Social Media',
        platforms: ['Instagram', 'Facebook'],
        dayOffset: 3,
        priority: 'Medium',
        estimatedHours: 2,
        subtasks: ['Carousel slides', 'Copywriting']
      },
      {
        title: 'Doctor FAQ: Answers to Frequent Clinic Questions (Static Post)',
        format: 'Static Post',
        category: 'Social Media',
        platforms: ['Instagram', 'Facebook'],
        dayOffset: 5,
        priority: 'Medium',
        estimatedHours: 1.5,
        subtasks: ['Graphic creative', 'Caption']
      },
      {
        title: 'Doctor Credentials & Care Philosophy (Trust Creative)',
        format: 'Static Post',
        category: 'Social Media',
        platforms: ['Instagram', 'LinkedIn', 'Facebook'],
        dayOffset: 7,
        priority: 'High',
        estimatedHours: 2,
        subtasks: ['Design branding', 'Copy sign-off']
      }
    ]
  },
  {
    id: 'routine_monthly_healthcare_growth',
    name: 'Monthly Healthcare Growth Pack',
    bestFor: 'Premium healthcare institutions, multi-specialty clinics & top surgeons',
    industryMatch: ['Healthcare', 'Medical', 'Hospital', 'Doctor'],
    packageSuitability: ['Premium'],
    timeline: '30 Days (Full Monthly Routine)',
    productionRequirement: 'Video Production Heavy',
    teamDemand: 'Heavy',
    description: 'High-impact 18-deliverable monthly blueprint covering clinical authority, surgical walkthroughs, testimonials, and patient carousels.',
    workflow: ['Monthly editorial calendar', 'Batch shooting / asset receipt', 'Weekly video editing sprints', 'Design sprints', 'Approvals', 'Automated scheduling'],
    deliverables: [
      { title: 'Week 1: Expert Medical Tip (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 2, priority: 'High', estimatedHours: 3, subtasks: ['Video edit', 'Client review'] },
      { title: 'Week 1: Clinical Infographic (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 4, priority: 'Medium', estimatedHours: 2, subtasks: ['Design', 'Copy'] },
      { title: 'Week 1: Condition Breakdown (Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['Instagram'], dayOffset: 6, priority: 'High', estimatedHours: 2.5, subtasks: ['Carousel design'] },
      { title: 'Week 2: Patient Case Milestone (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 9, priority: 'High', estimatedHours: 3, subtasks: ['Case study edit'] },
      { title: 'Week 2: Diagnostic Checklist (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 11, priority: 'Medium', estimatedHours: 2, subtasks: ['Graphic design'] },
      { title: 'Week 2: Treatment Options Comparison (Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['Instagram'], dayOffset: 13, priority: 'High', estimatedHours: 2.5, subtasks: ['Comparison design'] },
      { title: 'Week 3: Doctor Explains Procedure (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 16, priority: 'High', estimatedHours: 3, subtasks: ['Procedure video edit'] },
      { title: 'Week 3: Patient Testimonial & Review (Trust Creative)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 18, priority: 'High', estimatedHours: 2, subtasks: ['Testimonial card'] },
      { title: 'Week 3: Pre-Op & Post-Op Guidelines (Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['Instagram'], dayOffset: 20, priority: 'Medium', estimatedHours: 2.5, subtasks: ['Guideline slides'] },
      { title: 'Week 4: Lifestyle & Diet Prevention Advice (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 23, priority: 'High', estimatedHours: 3, subtasks: ['Reel edit'] },
      { title: 'Week 4: Hospital / Clinic Facility Highlight (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 25, priority: 'Medium', estimatedHours: 2, subtasks: ['Facility photo treatment'] },
      { title: 'Week 4: Monthly Medical Q&A Summary (Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['Instagram'], dayOffset: 27, priority: 'Medium', estimatedHours: 2.5, subtasks: ['Summary carousel'] }
    ]
  },
  {
    id: 'routine_local_brand_growth',
    name: 'Local Brand Weekly Growth',
    bestFor: 'Local service businesses, showrooms, clinics & retail providers',
    industryMatch: ['Local', 'Retail', 'Hardware', 'Architectural', 'Service', 'Manufacturing'],
    packageSuitability: ['Starter', 'Growth'],
    timeline: '7 Days',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'Weekly cadence balancing customer trust, promotional offers, service highlights, and behind-the-scenes reels.',
    workflow: ['Offer planning', 'Reel production', 'Ad creative design', 'Google Business Profile sync', 'Publishing'],
    deliverables: [
      { title: 'Behind the Scenes & Quality Showcase (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'Facebook'], dayOffset: 1, priority: 'High', estimatedHours: 3, subtasks: ['BTS edit', 'Music track'] },
      { title: 'Featured Service / Product Breakdown (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook', 'Google Business Profile'], dayOffset: 3, priority: 'Medium', estimatedHours: 2, subtasks: ['Product graphics', 'Offer details'] },
      { title: 'Customer Review & Project Showcase (Testimonial Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 5, priority: 'High', estimatedHours: 1.5, subtasks: ['Customer feedback card'] },
      { title: 'Weekend Special Offer & Community Engagement (Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 6, priority: 'High', estimatedHours: 2, subtasks: ['Offer banner design'] }
    ]
  },
  {
    id: 'routine_product_fmcg_sprint',
    name: 'Product & FMCG Content Sprint',
    bestFor: 'Food, consumer goods, beverage & manufacturing brands',
    industryMatch: ['Manufacturing', 'FMCG', 'Food', 'Beverage', 'Retail', 'Product'],
    packageSuitability: ['Growth', 'Premium'],
    timeline: '7 Days',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'Dynamic product visualizer sprint combining crisp product demo reels, packaging highlights, hygiene standards, and distributor outreach.',
    workflow: ['Product shot review', 'Video grading & pacing', 'Graphic package highlights', 'Client approval', 'Schedule'],
    deliverables: [
      { title: 'Purity & Manufacturing Process in Action (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'Facebook'], dayOffset: 1, priority: 'High', estimatedHours: 3, subtasks: ['Purity video cut', 'Sound design'] },
      { title: 'Key Product Advantages & Cold Chain Standards (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook', 'LinkedIn'], dayOffset: 3, priority: 'Medium', estimatedHours: 2, subtasks: ['Key benefits infographic'] },
      { title: 'Lifestyle Consumption & Summer Hydration Tips (Lifestyle Creative)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 5, priority: 'Medium', estimatedHours: 2, subtasks: ['Lifestyle visual render'] },
      { title: 'Distributor & Bulk Inquiry Offer (Conversion Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook', 'LinkedIn'], dayOffset: 7, priority: 'High', estimatedHours: 2, subtasks: ['B2B order CTA design'] }
    ]
  },
  {
    id: 'routine_real_estate_leadgen',
    name: 'Real Estate Lead Generation Pack',
    bestFor: 'Property developers, real estate advisors & luxury brokers',
    industryMatch: ['Real Estate', 'Properties', 'Architecture', 'Commercial'],
    packageSuitability: ['Growth', 'Premium'],
    timeline: '10 Days',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'High-converting property listing pack with walkthrough reels, unit floor plans, location advantages, and investment ROI carousels.',
    workflow: ['Property brief', 'Walkthrough reel edit', 'Floorplan infographic', 'Ad copy review', 'Approval', 'Campaign launch'],
    deliverables: [
      { title: 'Luxury Property Tour & Walkthrough Highlight (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube', 'Facebook'], dayOffset: 2, priority: 'Urgent', estimatedHours: 3.5, subtasks: ['Property walkthrough cut', 'Drone footage grading'] },
      { title: '5 Reasons Why Location ROI Outperforms (Listing Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['Instagram', 'Facebook', 'LinkedIn'], dayOffset: 4, priority: 'High', estimatedHours: 2.5, subtasks: ['ROI infographic slides'] },
      { title: 'Unit Floor Plan & Amenity Spotlight (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 7, priority: 'Medium', estimatedHours: 2, subtasks: ['Floor plan visual'] },
      { title: 'Limited Time Payment Plan & Lead Gen Booking (Creative)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 9, priority: 'Urgent', estimatedHours: 2, subtasks: ['Lead generation ad creative'] }
    ]
  },
  {
    id: 'routine_performance_campaign_support',
    name: 'Performance Campaign Support Pack',
    bestFor: 'Clients actively running Meta, Google, or LinkedIn paid ads',
    industryMatch: ['Consultancy', 'Business', 'Performance', 'Healthcare', 'Real Estate', 'Retail'],
    packageSuitability: ['Growth', 'Premium'],
    timeline: '7 Days',
    productionRequirement: 'Content + Design',
    teamDemand: 'Moderate',
    description: 'Conversion-focused creative assets built for paid advertising hooks, retargeting testimonials, and landing page creative cohesion.',
    workflow: ['Ad angles planning', 'Hook design & headline testing', 'Creative sizing (1:1 & 9:16)', 'Approval', 'Hand-off to media buyer'],
    deliverables: [
      { title: 'Direct Problem-Solution Hook Ad Creative (Static Post)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 1, priority: 'Urgent', estimatedHours: 2, subtasks: ['Ad angle copy', 'Design variations'] },
      { title: 'Fast 15-Second Video Ad Hook with Dynamic Subtitles (Reel)', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'Facebook', 'YouTube'], dayOffset: 3, priority: 'Urgent', estimatedHours: 3, subtasks: ['Fast-paced cut', 'CTA bumper'] },
      { title: 'Retargeting Social Proof & High-Trust Testimonial (Creative)', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 5, priority: 'High', estimatedHours: 2, subtasks: ['Trust proof design'] },
      { title: 'Limited Window Booking / Consultation Offer Creative', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 7, priority: 'High', estimatedHours: 2, subtasks: ['Urgency CTA design'] }
    ]
  },
  {
    id: 'routine_short_form_video_sprint',
    name: 'Short-Form Video Sprint (6 Reels)',
    bestFor: 'Reel-heavy brands aiming for viral reach and organic algorithmic growth',
    industryMatch: ['Healthcare', 'Retail', 'Consultancy', 'Manufacturing', 'Food', 'Real Estate'],
    packageSuitability: ['Growth', 'Premium'],
    timeline: '10 Days',
    productionRequirement: 'Video Production Heavy',
    teamDemand: 'Heavy',
    description: 'Dedicated 6-reel production sprint for rapid short-form publishing with animated captions, motion typography, and sound design.',
    workflow: ['Topic selection', 'Script outlines', 'Batch video editing', 'Typography & sound sync', 'Client approval', 'Scheduling'],
    deliverables: [
      { title: 'Reel #1: Viral Hook & Core Question', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 1, priority: 'High', estimatedHours: 3, subtasks: ['Video edit', 'Sound sync'] },
      { title: 'Reel #2: Step-by-Step Educational Solution', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 3, priority: 'High', estimatedHours: 3, subtasks: ['Video edit', 'Subtitles'] },
      { title: 'Reel #3: Debunking Common Industry Misconception', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 5, priority: 'High', estimatedHours: 3, subtasks: ['Video edit', 'Motion graphics'] },
      { title: 'Reel #4: Behind the Scenes Action & Quality', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 7, priority: 'Medium', estimatedHours: 2.5, subtasks: ['BTS cut', 'Audio mix'] },
      { title: 'Reel #5: Case Study & Proven Result', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 8, priority: 'High', estimatedHours: 3, subtasks: ['Case edit', 'Approval'] },
      { title: 'Reel #6: Weekly Round-Up & Call to Action', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 10, priority: 'High', estimatedHours: 2.5, subtasks: ['CTA outro', 'Publish'] }
    ]
  },
  {
    id: 'routine_brand_trust_builder',
    name: 'Brand Trust & Authority Builder',
    bestFor: 'B2B service consultancies, law firms & professional agencies',
    industryMatch: ['Consultancy', 'Business', 'Senior Healthcare', 'Financial', 'Corporate'],
    packageSuitability: ['Starter', 'Growth', 'Premium'],
    timeline: '14 Days',
    productionRequirement: 'Video + Design',
    teamDemand: 'Moderate',
    description: 'Multi-format authority sequence featuring founder insight reels, client case studies, FAQ carousels, and milestone highlights.',
    workflow: ['Founder insight brief', 'Interview cut', 'Case study graphics', 'LinkedIn formatting', 'Approval'],
    deliverables: [
      { title: 'Founder Insight: Strategic Perspective & Industry Trend (Reel)', format: 'Reel', category: 'Video Production', platforms: ['LinkedIn', 'Instagram'], dayOffset: 2, priority: 'High', estimatedHours: 3, subtasks: ['Insight video cut'] },
      { title: 'Client Transformation Story & Key Metric Growth (Case Study)', format: 'Static Post', category: 'Social Media', platforms: ['LinkedIn', 'Instagram', 'Facebook'], dayOffset: 5, priority: 'High', estimatedHours: 2.5, subtasks: ['Case study layout'] },
      { title: 'Client FAQ: Navigating Complex Decisions (Carousel)', format: 'Carousel', category: 'Social Media', platforms: ['LinkedIn', 'Instagram'], dayOffset: 8, priority: 'Medium', estimatedHours: 2, subtasks: ['Carousel slides'] },
      { title: 'Team Culture & Operational Excellence (Behind-the-Scenes)', format: 'Static Post', category: 'Social Media', platforms: ['LinkedIn', 'Instagram'], dayOffset: 11, priority: 'Medium', estimatedHours: 1.5, subtasks: ['Culture post visual'] },
      { title: 'Core Framework & Methodology Overview (Infographic)', format: 'Static Post', category: 'Social Media', platforms: ['LinkedIn', 'Instagram'], dayOffset: 14, priority: 'High', estimatedHours: 2, subtasks: ['Framework graphic'] }
    ]
  },
  {
    id: 'routine_monthly_social_baseline',
    name: 'Monthly Social Media Baseline',
    bestFor: 'Standard ongoing agency retainers maintaining steady online presence',
    industryMatch: ['All', 'General', 'Retail', 'Healthcare', 'Manufacturing'],
    packageSuitability: ['Starter', 'Growth', 'Premium'],
    timeline: 'Monthly (30 Days)',
    productionRequirement: 'Content + Design',
    teamDemand: 'Light',
    description: 'Dependable 10-item monthly baseline balancing weekly static updates, educational carousels, and monthly cornerstone reels.',
    workflow: ['Monthly asset collection', 'Content design sprint', 'Reel editing', 'Client approval', 'Scheduled cadence'],
    deliverables: [
      { title: 'Week 1 Educational Carousel', format: 'Carousel', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 3, priority: 'Medium', estimatedHours: 2, subtasks: ['Design', 'Copy'] },
      { title: 'Week 1 Brand Value Post', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 6, priority: 'Medium', estimatedHours: 1.5, subtasks: ['Visual creative'] },
      { title: 'Week 2 Cornerstone Highlight Reel', format: 'Reel', category: 'Video Production', platforms: ['Instagram', 'YouTube'], dayOffset: 10, priority: 'High', estimatedHours: 3, subtasks: ['Reel edit'] },
      { title: 'Week 2 Community & Team Spotlight', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 13, priority: 'Low', estimatedHours: 1.5, subtasks: ['Photo post'] },
      { title: 'Week 3 Step-by-Step Guide Carousel', format: 'Carousel', category: 'Social Media', platforms: ['Instagram', 'LinkedIn'], dayOffset: 17, priority: 'Medium', estimatedHours: 2, subtasks: ['Guide design'] },
      { title: 'Week 3 Product / Service Advantage Post', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 20, priority: 'Medium', estimatedHours: 1.5, subtasks: ['Ad graphic'] },
      { title: 'Week 4 Trending Audio Reel', format: 'Reel', category: 'Video Production', platforms: ['Instagram'], dayOffset: 24, priority: 'High', estimatedHours: 2.5, subtasks: ['Reel cut'] },
      { title: 'Week 4 Monthly Recap & Highlights Post', format: 'Static Post', category: 'Social Media', platforms: ['Instagram', 'Facebook'], dayOffset: 28, priority: 'Medium', estimatedHours: 2, subtasks: ['Recap creative'] }
    ]
  }
];

export interface SmartContentRoutinesProps {
  clients: ClientData[];
  employees: MasterEmployee[];
  calendarEntries?: CalendarEntry[];
  selectedClientId?: string | null;
  onSelectClient?: (clientId: string) => void;
  onLoadRoutineIntoReview: (tasks: ParsedWorkTask[], targetClientId: string, targetClientName: string, routineName: string) => void;
}

export const SmartContentRoutines: React.FC<SmartContentRoutinesProps> = ({
  clients,
  employees,
  calendarEntries = [],
  selectedClientId,
  onSelectClient,
  onLoadRoutineIntoReview
}) => {
  const [activeClientId, setActiveClientId] = useState<string>(selectedClientId || '');
  const [previewRoutine, setPreviewRoutine] = useState<SmartRoutineDefinition | null>(null);
  const [customRoutines, setCustomRoutines] = useState<SmartRoutineDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('digi_smart_custom_routines_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync external client selection
  useEffect(() => {
    if (selectedClientId) {
      setActiveClientId(selectedClientId);
    }
  }, [selectedClientId]);

  // Save custom routines to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('digi_smart_custom_routines_v1', JSON.stringify(customRoutines));
    } catch {}
  }, [customRoutines]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find(c => c.clientId === activeClientId) || null;
  }, [clients, activeClientId]);

  // ──────────────────────────────────────────────────────────────────────────
  // REAL-DATA ANALYTICS & CAPACITY CALCULATIONS
  // ──────────────────────────────────────────────────────────────────────────
  const clientAnalytics = useMemo(() => {
    if (!selectedClient) {
      return {
        scheduledCount: 0,
        reelsCount: 0,
        postsCount: 0,
        carouselsCount: 0,
        pendingApprovalsCount: 0,
        category: 'General',
        package: 'Growth',
        leadAssignee: 'Unassigned'
      };
    }

    const clientEntries = calendarEntries.filter(e => e.clientId === selectedClient.clientId);
    const reelsCount = clientEntries.filter(e => ['Reel', 'Video', 'YouTube Short'].includes(e.contentType)).length;
    const postsCount = clientEntries.filter(e => e.contentType === 'Static Post').length;
    const carouselsCount = clientEntries.filter(e => e.contentType === 'Carousel').length;
    const pendingApprovalsCount = clientEntries.filter(e => e.clientApprovalStatus === 'Pending' || e.status === 'Sent for Approval').length;

    return {
      scheduledCount: clientEntries.length,
      reelsCount,
      postsCount,
      carouselsCount,
      pendingApprovalsCount,
      category: selectedClient.category || 'General',
      package: (selectedClient.package as 'Starter' | 'Growth' | 'Premium') || 'Growth',
      leadAssignee: employees[0]?.name || 'Agency Lead'
    };
  }, [selectedClient, calendarEntries, employees]);

  // Overall Team Workload Calculation
  const teamWorkloadState = useMemo(() => {
    const totalVideoItems = calendarEntries.filter(e => ['Reel', 'Video', 'YouTube Short'].includes(e.contentType) && e.status !== 'Posted').length;
    
    if (totalVideoItems > 16) {
      return { status: 'Heavy' as const, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900', label: 'Video Team Busy (Extended Lead Time)' };
    }
    if (totalVideoItems > 8) {
      return { status: 'Busy' as const, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900', label: 'Balanced Production Flow' };
    }
    return { status: 'Available' as const, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900', label: 'Production Capacity Available' };
  }, [calendarEntries]);

  // ──────────────────────────────────────────────────────────────────────────
  // RECOMMENDATION ENGINE (Real Data Ranking)
  // ──────────────────────────────────────────────────────────────────────────
  const { recommendedRoutines, standardRoutines } = useMemo(() => {
    const allRoutines = [...MASTER_AGENCY_ROUTINES, ...customRoutines];

    if (!selectedClient) {
      return {
        recommendedRoutines: [],
        standardRoutines: allRoutines
      };
    }

    const clientCategoryLower = (selectedClient.category || '').toLowerCase();
    const clientPackage = selectedClient.package || 'Growth';

    const ranked = allRoutines.map(routine => {
      let score = 0;
      let why = '';

      // 1. Industry Match
      const isIndustryMatch = routine.industryMatch.some(m => clientCategoryLower.includes(m.toLowerCase()));
      if (isIndustryMatch) {
        score += 50;
        why = `Directly tailored for ${selectedClient.category} client profiles.`;
      }

      // 2. Package Match
      if (routine.packageSuitability.includes(clientPackage as any)) {
        score += 25;
        if (!why) why = `Matches ${selectedClient.clientName}'s ${clientPackage} retainer tier.`;
      }

      // 3. Calendar Gap Analysis
      if (clientAnalytics.reelsCount === 0 && routine.deliverables.some(d => d.format === 'Reel')) {
        score += 20;
        why += ` Currently 0 reels scheduled in calendar.`;
      }
      if (clientAnalytics.carouselsCount === 0 && routine.deliverables.some(d => d.format === 'Carousel')) {
        score += 15;
      }

      // 4. Pending Approval Consideration
      if (clientAnalytics.pendingApprovalsCount >= 3) {
        why += ` (Note: ${clientAnalytics.pendingApprovalsCount} items already awaiting client approval).`;
      }

      return {
        ...routine,
        recommendationScore: score,
        whyRecommended: why || `Standard recommended agency cadence for ${clientPackage} tier accounts.`
      };
    });

    ranked.sort((a, b) => b.recommendationScore - a.recommendationScore);

    const recommended = ranked.filter(r => r.recommendationScore >= 40);
    const standard = ranked.filter(r => r.recommendationScore < 40);

    return {
      recommendedRoutines: recommended.length > 0 ? recommended : ranked.slice(0, 3),
      standardRoutines: standard.length > 0 ? standard : ranked.slice(3)
    };
  }, [selectedClient, clientAnalytics, customRoutines]);

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLER: Convert Routine Deliverables to Review & Assign Drafts
  // ──────────────────────────────────────────────────────────────────────────
  const handleLoadRoutine = (routine: SmartRoutineDefinition) => {
    const targetClientObj = selectedClient || clients[0];
    const targetClientId = targetClientObj?.clientId || '';
    const targetClientName = targetClientObj?.clientName || 'General Account';

    const baseDate = new Date();
    const generatedTasks: ParsedWorkTask[] = routine.deliverables.map((deliv) => {
      // Calculate intelligent date distribution
      const itemDate = new Date(baseDate);
      itemDate.setDate(itemDate.getDate() + deliv.dayOffset);
      
      // Skip Sundays if desired (shift to Monday)
      if (itemDate.getDay() === 0) {
        itemDate.setDate(itemDate.getDate() + 1);
      }
      const dueDateStr = itemDate.toISOString().split('T')[0];

      // Assign maker if possible (match role: Video Editor for Reels, Graphic Designer for Posts)
      let defaultAssigneeId = '';
      let defaultAssigneeName = 'Unassigned';

      if (deliv.format === 'Reel' || deliv.format === 'Video') {
        const videoEditor = employees.find(e => e.role?.toLowerCase().includes('video') || e.role?.toLowerCase().includes('editor'));
        if (videoEditor) {
          defaultAssigneeId = videoEditor.employeeId || videoEditor.id;
          defaultAssigneeName = videoEditor.name;
        }
      } else {
        const designer = employees.find(e => e.role?.toLowerCase().includes('design') || e.role?.toLowerCase().includes('graphic'));
        if (designer) {
          defaultAssigneeId = designer.employeeId || designer.id;
          defaultAssigneeName = designer.name;
        }
      }

      return {
        id: 'draft_' + Math.random().toString(36).substring(2, 9),
        title: `${deliv.title}`,
        category: deliv.category,
        format: deliv.format,
        platforms: deliv.platforms,
        quantity: 1,
        priority: deliv.priority,
        assigneeId: defaultAssigneeId,
        assigneeName: defaultAssigneeName,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: dueDateStr,
        publishDate: dueDateStr,
        estimatedHours: deliv.estimatedHours,
        instructions: `Delivery Plan: ${routine.name}. Best For: ${routine.bestFor}. Workflow: ${routine.workflow.join(' -> ')}`,
        status: 'Planned',
        isRecurring: false,
        recurrenceRule: '',
        confidence: 1.0,
        inferredFields: ['platforms', 'dueDate', 'workflow'],
        subtasks: deliv.subtasks.map(st => ({
          title: st,
          checked: true,
          assigneeId: defaultAssigneeId,
          assigneeName: defaultAssigneeName,
          dueDate: dueDateStr
        }))
      };
    });

    onLoadRoutineIntoReview(generatedTasks, targetClientId, targetClientName, routine.name);
    setPreviewRoutine(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TOP: CLIENT CONTEXT SELECTOR & CAPACITY SUMMARY                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Client Context Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-grow">
            <div className="w-full sm:w-72">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Select Client for Smart Adaptation
              </label>
              <ClientSelect
                clients={clients}
                selectedClientId={activeClientId}
                onSelectClient={(id) => {
                  setActiveClientId(id);
                  if (onSelectClient) onSelectClient(id);
                }}
                placeholder="Pick client account to adapt routines..."
              />
            </div>

            {selectedClient ? (
              <div className="flex items-center flex-wrap gap-2 pt-1 sm:pt-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                  <Building2 className="w-3.5 h-3.5" />
                  {clientAnalytics.category}
                </span>

                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                  clientAnalytics.package === 'Premium' 
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                    : clientAnalytics.package === 'Growth'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {clientAnalytics.package} Retainer
                </span>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {clientAnalytics.scheduledCount} Scheduled Items
                </span>

                {clientAnalytics.pendingApprovalsCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    {clientAnalytics.pendingApprovalsCount} Awaiting Approval
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1 sm:pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Select a client account to receive personalized delivery workflows based on package and calendar state.</span>
              </div>
            )}
          </div>

          {/* Right: Workload & Capacity Badge */}
          <div className="shrink-0 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black border ${teamWorkloadState.color}`}>
              <Zap className="w-3.5 h-3.5" />
              <span>{teamWorkloadState.label}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: RECOMMENDED FOR SELECTED CLIENT                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedClient && recommendedRoutines.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Recommended For {selectedClient.clientName}
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
                Matched to Industry & Retainer
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {recommendedRoutines.length} Optimized Workflows
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recommendedRoutines.map(routine => (
              <RoutineCard 
                key={routine.id}
                routine={routine}
                isRecommended
                onPreview={() => setPreviewRoutine(routine)}
                onLoad={() => handleLoadRoutine(routine)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: AGENCY STANDARD ROUTINES                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Agency Standard Delivery Catalog
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {standardRoutines.length} Proven Retainer Packages
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {standardRoutines.map(routine => (
            <RoutineCard 
              key={routine.id}
              routine={routine}
              onPreview={() => setPreviewRoutine(routine)}
              onLoad={() => handleLoadRoutine(routine)}
            />
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* PREVIEW PLAN MODAL / DRAWER                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {previewRoutine && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{previewRoutine.name}</h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    {previewRoutine.deliverables.length} Deliverables
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
                    {previewRoutine.timeline}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {previewRoutine.description}
                </p>
              </div>
              <button onClick={() => setPreviewRoutine(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Workflow Milestones */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3 h-3 text-purple-500" />
                Delivery Milestones & Quality Checkpoints
              </span>
              <div className="flex items-center flex-wrap gap-1.5">
                {previewRoutine.workflow.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {idx + 1}. {step}
                    </span>
                    {idx < previewRoutine.workflow.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Itemized Deliverables Table */}
            <div className="overflow-y-auto flex-grow space-y-2.5 pr-1 custom-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Itemized Schedule Breakdown
              </span>

              {previewRoutine.deliverables.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase">
                        Day +{item.dayOffset}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        item.format === 'Reel' || item.format === 'Video' 
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900' 
                          : item.format === 'Carousel'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-900'
                      }`}>
                        {item.format}
                      </span>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white">{item.title}</h5>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <span>Platforms: {item.platforms.join(', ')}</span>
                      <span>•</span>
                      <span>Est: {item.estimatedHours} hrs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {item.subtasks.length} Checkpoints
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewRoutine(null)}
                className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Close Preview
              </button>

              <button
                type="button"
                onClick={() => handleLoadRoutine(previewRoutine)}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-sm hover:shadow-md transition-all inline-flex items-center gap-2"
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>Load Into Review & Assign ({previewRoutine.deliverables.length} Items)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// ROUTINE CARD COMPONENT
// ────────────────────────────────────────────────────────────────────────────
interface RoutineCardProps {
  routine: SmartRoutineDefinition & { whyRecommended?: string };
  isRecommended?: boolean;
  onPreview: () => void;
  onLoad: () => void;
}

const RoutineCard: React.FC<RoutineCardProps> = ({
  routine,
  isRecommended = false,
  onPreview,
  onLoad
}) => {
  const reelCount = routine.deliverables.filter(d => ['Reel', 'Video', 'YouTube Short'].includes(d.format)).length;
  const postCount = routine.deliverables.filter(d => d.format === 'Static Post').length;
  const carouselCount = routine.deliverables.filter(d => d.format === 'Carousel').length;

  return (
    <div className={`p-4 rounded-3xl border transition-all flex flex-col justify-between space-y-3.5 relative overflow-hidden group ${
      isRecommended 
        ? 'bg-gradient-to-b from-purple-50/40 to-white dark:from-purple-950/20 dark:to-slate-950 border-purple-200 dark:border-purple-900/60 shadow-xs hover:border-purple-400'
        : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 shadow-xs'
    }`}>
      
      {/* Top badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
            {routine.deliverables.length} Deliverables
          </span>
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md">
            {routine.timeline}
          </span>
        </div>

        <div>
          <h4 className="text-xs font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {routine.name}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 mt-0.5">
            Best for: {routine.bestFor}
          </p>
        </div>

        {/* Deliverable Mix Pills */}
        <div className="flex items-center flex-wrap gap-1 pt-0.5">
          {reelCount > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-900">
              {reelCount} Reels
            </span>
          )}
          {postCount > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-900">
              {postCount} Posts
            </span>
          )}
          {carouselCount > 0 && (
            <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-900">
              {carouselCount} Carousels
            </span>
          )}
        </div>

        {/* Real-data recommendation reason */}
        {routine.whyRecommended && (
          <div className="p-2 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/40 text-[10px] font-medium text-purple-900 dark:text-purple-200 flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 text-purple-600 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-relaxed">{routine.whyRecommended}</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="py-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all inline-flex items-center gap-1"
          title="Preview complete delivery schedule"
        >
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>Preview</span>
        </button>

        <button
          type="button"
          onClick={onLoad}
          className="py-1.5 px-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
        >
          <ListPlus className="w-3.5 h-3.5" />
          <span>Load Into Review</span>
        </button>
      </div>
    </div>
  );
};
