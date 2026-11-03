
import React from 'react';
import { BlogPost, Package } from './types';

/** Live plan catalog - `price` = one-time setup (monthly billing). Setup waived only on annual. */
export const PACKAGES: Package[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 2500,
    monthly: 497,
    yearlyPrice: 4764,
    description: 'or $4,764/year (setup fee waived)',
    features: [
      '500 min/month (~100 calls)',
      'Basic voice',
      'WhatsApp booking',
      '24/7 coverage',
      'Website chatbot widget',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 5000,
    monthly: 997,
    yearlyPrice: 9564,
    description: 'Recommended · or $9,564/year (setup fee waived)',
    features: [
      '2,000 minutes/month',
      'Voice cloning + custom accents',
      'Upsell scripts + analytics',
      'Unlimited after cap',
      'WhatsApp chatbot',
      'All-Inboxes chatbot',
      'Image generation',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 10000,
    monthly: 1997,
    yearlyPrice: 19164,
    description: 'or $19,164/year (setup fee waived)',
    features: [
      'Unlimited min/calls',
      'Multi-store (up to 5)',
      'CRM + sales reports',
      'White-label + custom',
      'Nivoda integration',
      'Custom voice/analytics',
      'Every add-on included',
      'Dedicated account manager',
    ],
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: 20000,
    monthly: 3499,
    yearlyPrice: 33588,
    description: 'or $33,588/year (setup fee waived)',
    features: [
      'Everything in Enterprise',
      'Unlimited stores',
      'Custom API integrations',
      'Quarterly strategy calls',
      'Priority 24/7 support',
      'Co-branded marketing assets',
    ],
  },
];

/** Optional add-ons beyond base plans (most capabilities are included in tiers above) */
export const UPSELLS: {
  id: string;
  name: string;
  price: number;
  monthlyPrice?: number;
  description: string;
}[] = [
  {
    id: 'white_glove_onboarding',
    name: 'White-glove onboarding sprint',
    price: 1500,
    monthlyPrice: 0,
    description: 'Dedicated launch week with same-day script iterations and staff training.',
  },
  {
    id: 'extra_location_pack',
    name: 'Extra showroom location',
    price: 0,
    monthlyPrice: 399,
    description: 'Additional branded voice profile and routing for one more location.',
  },
];

export const PRICING_MATRIX = {
  tiers: [
    {
      name: 'Starter',
      monthly: 497,
      setup: 2500,
      details: '500 min/mo (~100 calls). Setup $2,500 on monthly; waived on annual.',
    },
    {
      name: 'Pro',
      monthly: 997,
      setup: 5000,
      details: '2,000 min/mo. Setup $5,000 on monthly; waived on annual.',
    },
    {
      name: 'Enterprise',
      monthly: 1997,
      setup: 10000,
      details: 'Unlimited minutes, up to 5 stores. Setup $10,000 on monthly; waived on annual.',
    },
    {
      name: 'Diamond',
      monthly: 3499,
      setup: 20000,
      details: 'Everything in Enterprise + unlimited stores. Setup $20,000 on monthly; waived on annual.',
    },
  ],
  addOns: [
    { name: 'White-glove onboarding sprint', price: '$1,500 one-time' },
    { name: 'Extra showroom location', price: '+$399/mo' },
  ],
  annualNote: 'Annual billing: pay yearly upfront; one-time setup fee waived (monthly plans include setup).',
};

export const BLOG_POSTS: BlogPost[] = [
  {
    id: '1',
    slug: 'how-ai-is-revolutionizing-jewelry-retail-2026',
    title: 'How AI is Revolutionizing Jewelry Retail in 2026',
    excerpt: 'The luxury market is evolving. Discover how AI agents are becoming the standard for client interactions.',
    date: 'Oct 24, 2025',
    imageUrl: 'assets/plates/plate_hero_ring.png',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    content: `
      ## The New Era of Luxury
      In 2026, the distinction between high-end digital assistance and human service is blurring. For jewelers, this means being available when inspiration strikes a client - be it at 2 PM or 2 AM.

      ### Key Transformations
      - **Instant Gratification:** Clients no longer wait for callbacks.
      - **Hyper-Personalization:** AI remembers past inquiries and preferences.
      - **Efficiency:** Routine questions are handled instantly, freeing staff for high-touch custom work.

      Luxury retail has always been about the experience. Fourcee brings that "white glove" service to the digital and telephonic realm.
    `
  },
  {
    id: '2',
    slug: 'top-5-pain-points-jewelers-solve-with-ai',
    title: 'Top 5 Pain Points for Jewelers and How Voice AI Solves Them',
    excerpt: 'From missed calls to staffing shortages, see why jewelers are turning to Fourcee.',
    date: 'Oct 20, 2025',
    imageUrl: 'assets/plates/plate_missed_call_phone.png',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    content: `
      ## Solving the Jewelry Business Bottlenecks
      1. **Missed High-Value Leads:** Every missed call is a potential $10,000 engagement ring sale.
      2. **Staff Burnout:** Constant interruptions hinder master jewelers at the bench.
      3. **Inconsistent Quotes:** Ensure every rough estimate follows your specific pricing logic.
      4. **No-Shows:** Automated reminders keep schedules full and revenue flowing.
      5. **Data Silos:** Automatically push every caller's details into your CRM.
    `
  },
  {
    id: '3',
    slug: 'maximizing-roi-with-custom-ai-receptionists',
    title: 'Maximizing ROI with Custom AI Receptionists',
    excerpt: 'A deep dive into the numbers behind the investment in voice AI for jewelry stores.',
    date: 'Oct 15, 2025',
    imageUrl: 'assets/plates/plate_ring_studio.png',
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    content: `
      ## The ROI Equation
      When you invest in an AI receptionist, you aren't just buying software. You are buying time and opportunity.

      ### The Math
      - **Cost of Staffing:** A full-time receptionist costs $40k+/year plus benefits.
      - **Opportunity Cost:** If AI captures just *one* extra custom ring lead per month, it pays for itself quickly.
    `
  }
  // ... Imagine 7 more posts here to satisfy the SEO requirement
];
