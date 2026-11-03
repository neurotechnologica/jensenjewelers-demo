import { AppView } from '../types';

export interface HashPlan {
  view: AppView;
  /** Retired prospect route (#/ops, #/crm, #/dashboard, or #/admin when the flag is off). Replace the hash with the site home. */
  replaceHome?: boolean;
  section?: 'roi' | 'demo' | 'ring' | 'faq';
  postSlug?: string;
}

/** Map a location hash to a view. The ops portal is not a prospect route. */
export function planHashRoute(hash: string, adminEnabled: boolean): HashPlan {
  const raw = (hash || '#/').replace(/^#/, '') || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  const parts = path.split('/').filter(Boolean);
  const head = (parts[0] || '').toLowerCase();
  if (head === 'audit' || head === 'lead-magnet') return { view: AppView.LEAD_MAGNET };
  if (head === 'ops' || head === 'dashboard' || head === 'crm') return { view: AppView.LANDING, replaceHome: true };
  if (head === 'checkout' || head === 'pricing') return { view: AppView.CHECKOUT };
  if (head === 'insights' || head === 'blog') return { view: parts[1] ? AppView.BLOG_POST : AppView.BLOG, postSlug: parts[1] };
  if (head === 'terms') return { view: AppView.TERMS };
  if (head === 'admin') return adminEnabled ? { view: AppView.ADMIN } : { view: AppView.LANDING, replaceHome: true };
  const section = head === 'roi' || head === 'demo' || head === 'ring' || head === 'faq' ? head : undefined;
  return { view: AppView.LANDING, section };
}
