
export type Category = 'All' | 'Website' | 'Web App' | 'Mobile App' | 'UI/UX';

export interface Project {
  id: string;
  slug: string;
  title: string;
  category: Category;
  description: string;
  fullDescription: string;
  image: string;
  outcome: string;
  techStack: string[];
  liveUrl?: string;
  features: string[];
  problem: string;
  solution: string;
  results: string[];
}

export interface Service {
  id: number;
  title: string;
  description: string;
  icon: string;
}

export interface CurrencyPrices {
  inr: string;
  usd: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: CurrencyPrices;
  annualPrice: CurrencyPrices;
  description: string;
  features: string[];
  popular?: boolean;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  content: string;
  avatar: string;
}
