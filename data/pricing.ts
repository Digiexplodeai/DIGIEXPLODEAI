
import { PricingPlan } from '../types';

export const webPricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: "Web Starter",
    monthlyPrice: { inr: "₹4,999", usd: "$59" },
    annualPrice: { inr: "₹3,999", usd: "$49" },
    description: "Perfect for personal brands and single-page landing pages.",
    features: [
      "1-Page Premium Website",
      "Basic SEO Setup",
      "Contact Form Integration"
    ]
  },
  {
    id: 'growth',
    name: "Web Growth",
    monthlyPrice: { inr: "₹14,999", usd: "$179" },
    annualPrice: { inr: "₹11,999", usd: "$149" },
    description: "Ideal for growing businesses needing more power.",
    features: [
      "4-Pages Premium Website",
      "Dynamic Web Application",
      "Advanced UI Animations",
      "Speed Optimization"
    ],
    popular: true
  },
  {
    id: 'pro',
    name: "Web Pro",
    monthlyPrice: { inr: "₹24,999", usd: "$299" },
    annualPrice: { inr: "₹19,999", usd: "$249" },
    description: "Custom solutions for enterprises and startups.",
    features: [
      "Full Custom Web/Mobile App",
      "E-Commerce Functionality",
      "Dedicated Admin Dashboard",
      "Complex API Integrations",
      "Premium UI/UX System",
      "Hosting & Deployment"
    ]
  }
];

export const androidPricingPlans: PricingPlan[] = [
  {
    id: 'android-lite',
    name: "Android Lite",
    monthlyPrice: { inr: "₹9,999", usd: "$119" },
    annualPrice: { inr: "₹7,999", usd: "$99" },
    description: "The complete digital start: Simple utility app + a professional web landing page.",
    features: [
      "Android App",
      "1-Page Premium Website",
      "Basic SEO & Contact Setup",
      "Basic UI/UX Design",
      "Cloudflare Integration"
    ]
  },
  {
    id: 'android-business',
    name: "Android Business",
    monthlyPrice: { inr: "₹19,999", usd: "$239" },
    annualPrice: { inr: "₹15,999", usd: "$189" },
    description: "Full-scale app for businesses needing growth and engagement.",
    features: [
      "4-Pages Premium Website",
      "Dynamic Web Application",
      "Advanced UI Animations",
      "Speed Optimization",
      "Custom UI/UX Prototypes",
      "Push Notifications",
      "Payment Gateway Integration",
      "Advanced API Connection",
      "Play Store Submission"
    ],
    popular: true
  },
  {
    id: 'android-enterprise',
    name: "Android Enterprise",
    monthlyPrice: { inr: "₹49,999", usd: "$599" },
    annualPrice: { inr: "₹39,999", usd: "$479" },
    description: "Scalable enterprise-grade apps with high-security needs.",
    features: [
      "Full Custom Web/Mobile App",
      "E-Commerce Functionality",
      "Dedicated Admin Dashboard",
      "Complex API Integrations",
      "Premium UI/UX System",
      "Hosting & Deployment",
      "High-Security Architecture",
      "Offline Mode Support",
      "Real-time Data Sync",
      "AI/Machine Learning Models",
      "Dedicated Project Manager",
      "24/7 Priority Support"
    ]
  }
];

export const bundlePricingPlans: PricingPlan[] = [
  {
    id: 'bundle-lite',
    name: "Ecosystem Lite",
    monthlyPrice: { inr: "₹24,999", usd: "$299" },
    annualPrice: { inr: "₹19,999", usd: "$249" },
    description: "Complete presence: Premium Website + Android + iOS Apps for startups.",
    features: [
      "1-Page Premium Website",
      "Android App",
      "iOS App",
      "Basic SEO & Contact Setup",
      "Basic UI/UX Design",
      "Cloudflare Integration",
      "Unified Branding System",
      "Shared Cloud Backend",
      "Basic Maintenance",
      "Full Web Pro Features"
    ]
  },
  {
    id: 'bundle-business',
    name: "Ecosystem Business",
    monthlyPrice: { inr: "₹49,999", usd: "$599" },
    annualPrice: { inr: "₹39,999", usd: "$479" },
    description: "The scaling powerhouse for businesses ready to dominate all platforms.",
    features: [
      "4-Pages Premium Website",
      "Android Business App",
      "iOS Business App",
      "Advanced UI Animations",
      "Payment Gateways Integration",
      "Push Notifications Hub",
      "Admin Control Panel",
      "Store SEO & Optimization",
      "Biometric Authentication"
    ],
    popular: true
  },
  {
    id: 'bundle-enterprise',
    name: "Ecosystem Enterprise",
    monthlyPrice: { inr: "₹99,999", usd: "$1,199" },
    annualPrice: { inr: "₹79,999", usd: "$999" },
    description: "Custom enterprise architecture with multi-platform synchronization.",
    features: [
      "Full Custom Web System",
      "Android Enterprise App",
      "iOS Enterprise App",
      "Offline Sync Support",
      "Real-time Data Streaming",
      "Custom AI Integration",
      "Enterprise Level Security",
      "White-label Solution",
      "Dedicated CTO Support",
      "High Availability Hosting"
    ]
  }
];

export const pricingPlans = [...webPricingPlans, ...androidPricingPlans, ...bundlePricingPlans];
