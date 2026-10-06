export interface ServiceDetail {
  id: string | number;
  num: string;
  category: 'Performance' | 'Social' | 'SEO' | 'Creative' | 'Web' | 'Brand';
  title: string;
  description: string;
  metric: string;
  theme: {
    bgLight: string;
    bgDark: string;
    accent: string;
    badge: string;
  };
  deliverables: string[];
  icon: string;
}

export const servicesData: ServiceDetail[] = [
  {
    id: 1,
    num: '01',
    category: 'Performance',
    title: 'Performance Marketing (Meta & Google Ads)',
    description: 'Direct-response paid ad campaigns engineered for maximum ROAS. Full-funnel architecture from creative hooks to purchase conversion.',
    metric: '4.8x Avg ROAS Benchmark',
    theme: {
      bgLight: '#11152D',
      bgDark: '#11152D',
      accent: '#5546F5',
      badge: 'High Conversion',
    },
    deliverables: [
      'Full-Funnel Meta (FB/IG) & Google Ads Architecture',
      'Dynamic Creative A/B Testing & Hook Variation',
      'High-Intent Lookalike & Retargeting Audiences',
      'Daily Budget & Bid Management for Peak ROAS',
      'Real-Time Attribution & Lead Reporting Dashboards'
    ],
    icon: 'TrendingUp'
  },
  {
    id: 2,
    num: '02',
    category: 'Social',
    title: 'Social Media Marketing & Content Engine',
    description: 'High-impact organic growth, platform-native video reels, community engagement, and viral distribution across Instagram, LinkedIn, and YouTube.',
    metric: '10M+ Reach Delivered',
    theme: {
      bgLight: '#EAE7FF',
      bgDark: '#1A1E40',
      accent: '#FF784F',
      badge: 'Viral Engine',
    },
    deliverables: [
      'Omnichannel Social Growth & Content Strategy',
      'Monthly High-Retention Video Reel Scripts & Edits',
      'Weekly Publishing Calendars & Creative Direction',
      'Community Management & Inbound DM Qualification',
      'Influencer Co-marketing & Creator Collaborations'
    ],
    icon: 'Share2'
  },
  {
    id: 3,
    num: '03',
    category: 'SEO',
    title: 'SEO & Search Authority Dominance',
    description: 'Technical SEO audits, high-intent keyword architectures, and link building that compound your organic search presence month-over-month.',
    metric: '+187% Organic Traffic Lift',
    theme: {
      bgLight: '#FFFFFF',
      bgDark: '#161B3A',
      accent: '#B8F36B',
      badge: 'Compounding Asset',
    },
    deliverables: [
      'Comprehensive Technical Site Audit & Fixes',
      'High-Commercial Intent Keyword Mapping',
      'Editorial Long-Form Content & Pillar Pages',
      'High-Authority White-Hat Backlink Acquisition',
      'Core Web Vitals & Page Speed Acceleration'
    ],
    icon: 'Search'
  },
  {
    id: 4,
    num: '04',
    category: 'Creative',
    title: 'Creative & Video Production',
    description: 'Direct-response video hooks, 3D graphics, carousel sequences, and lifestyle creative assets designed specifically to stop the scroll and convert.',
    metric: '18+ Creatives / Month',
    theme: {
      bgLight: '#F7F5F0',
      bgDark: '#1F2550',
      accent: '#FF784F',
      badge: 'Scroll Stopping',
    },
    deliverables: [
      'Direct-Response Ad Creatives & Video Hooks',
      'Vertical Short-Form Content (Reels & Shorts)',
      'High-CTR Story & Carousel Ad Sets',
      'Product Mockups & Visual Identity Collateral',
      'Conversion-Optimized Sales Copywriting'
    ],
    icon: 'Video'
  },
  {
    id: 5,
    num: '05',
    category: 'Web',
    title: 'High-Converting Websites & Web Apps',
    description: 'Fast, responsive React and Next.js applications engineered for high conversion rates, seamless CRM/payment integrations, and sub-second load times.',
    metric: '99 Lighthouse Performance',
    theme: {
      bgLight: '#EAE7FF',
      bgDark: '#181E44',
      accent: '#5546F5',
      badge: 'Sub-Second Speed',
    },
    deliverables: [
      'Custom UX/UI Wireframes & High-Fidelity Figma Designs',
      'Modern React, Next.js & Tailwind Development',
      'Seamless Razorpay, Stripe & Webhook Integrations',
      'Interactive ROI Calculators & Multi-Step Funnels',
      'Mobile-First Responsiveness & SEO Optimization'
    ],
    icon: 'Monitor'
  },
  {
    id: 6,
    num: '06',
    category: 'Brand',
    title: 'Brand Strategy & Identity Systems',
    description: 'Positioning, messaging architecture, visual identity, and competitive differentiation to command authority and command premium pricing in your market.',
    metric: 'Full Brand Identity Kit',
    theme: {
      bgLight: '#FFFFFF',
      bgDark: '#141834',
      accent: '#B8F36B',
      badge: 'Authority Building',
    },
    deliverables: [
      'Competitive Market Positioning & Category Design',
      'Brand Voice, Tone & Messaging Matrix',
      'Complete Logo, Color System & Typography Guidelines',
      'Sales Pitch Decks & Marketing Asset Kits',
      'Brand Execution Guidelines for Scale'
    ],
    icon: 'Compass'
  }
];
