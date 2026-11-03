
export enum AppView {
  LANDING = 'landing',
  LEAD_MAGNET = 'lead-magnet',
  BLOG = 'blog',
  BLOG_POST = 'blog-post',
  CHECKOUT = 'checkout',
  DASHBOARD = 'dashboard',
  ADMIN = 'admin',
  TERMS = 'terms',
}

export interface CallRecord {
  id: string;
  caller: string;
  duration: string;
  status: 'Booked' | 'Inquiry' | 'Missed' | 'Estimate';
  sentiment: 'Positive' | 'Neutral' | 'Urgent';
  timestamp: string;
  transcript: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  youtubeUrl?: string;
  imageUrl: string;
  date: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  monthly: number;
  yearlyPrice: number;
  description: string;
  features: string[];
}

export interface CheckoutState {
  packageId: string;
  upsells: string[];
  form: Record<string, string>;
  step: number;
  /** Billing cadence for checkout totals */
  billingCycle: 'monthly' | 'annual';
}
