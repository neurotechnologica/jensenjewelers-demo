import { assetUrl } from './asset-url';
import { GBP_PLACEHOLDER_TOKENS } from '../components/audit-placeholders';
import type { AuditData } from '../types/audit';

/**
 * Neuro generator contract — do not rename these strings.
 * The generator overwrites `public/content.json` and may also string-replace
 * the PLACEHOLDER_* tokens below in source.
 */
export const AUDIT_CONTENT_URL = '/content.json';
export const PLACEHOLDER_BUSINESS_NAME = 'PLACEHOLDER Business';
export const PLACEHOLDER_REPORT_ID = 'PLACEHOLDER';

export const GBP_SOURCE_TOKENS = GBP_PLACEHOLDER_TOKENS;

export function isPlaceholderBusinessName(name: string | undefined | null): boolean {
  return !name || name.trim() === '' || name === PLACEHOLDER_BUSINESS_NAME;
}

/**
 * Load order (must stay stable for Neuro):
 * 1) GET `/content.json` (generator writes this file per client)
 * 2) Parse JSON with the published AuditData key names
 * 3) Fill only missing OPTIONAL fields — never rename or drop keys
 */
export async function loadAuditContent(): Promise<AuditData> {
  const response = await fetch(AUDIT_CONTENT_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${AUDIT_CONTENT_URL} (${response.status})`);
  }
  const raw = (await response.json()) as AuditData;
  return normalizeAuditData(raw);
}

/**
 * Preserve every Neuro key. Optional apollo-only fields (heroImageUrl) stay optional.
 */
export function normalizeAuditData(raw: AuditData): AuditData {
  const business = raw.business ?? ({} as AuditData['business']);
  const branding = raw.branding;
  const reviews = raw.reviews ?? ({} as AuditData['reviews']);
  const liveDemo = raw.liveDemo ?? ({} as AuditData['liveDemo']);
  const compliance = raw.compliance ?? ({} as AuditData['compliance']);
  const recoveryPlan = raw.recoveryPlan ?? ({} as AuditData['recoveryPlan']);

  return {
    ...raw,
    lead_id: raw.lead_id,
    auditMeta: raw.auditMeta,
    business: {
      ...business,
      name: business.name || PLACEHOLDER_BUSINESS_NAME,
      logoUrl: business.logoUrl || branding?.clientLogoUrl || branding?.logoWordmarkUrl || '',
      heroImageUrl: business.heroImageUrl || undefined,
    },
    reviews: {
      ...reviews,
      starsDisplay: reviews.starsDisplay || GBP_SOURCE_TOKENS.stars,
      quote1: reviews.quote1 || '',
      quote2: reviews.quote2 || '',
      themes: reviews.themes || [],
    },
    liveDemo: {
      ...liveDemo,
      ctaLabel: liveDemo.ctaLabel || 'Try Fourcee on your phone',
      helperCopy: liveDemo.helperCopy || 'No charge.',
      phoneCountryDefault: liveDemo.phoneCountryDefault || '+27',
      demoDurationHint: liveDemo.demoDurationHint || '~60–90s.',
    },
    ringBuilder: raw.ringBuilder,
    recoveryPlan: {
      ...recoveryPlan,
      headline: recoveryPlan.headline || 'Recommended Recovery Plan',
      body: recoveryPlan.body || '',
      capabilities: recoveryPlan.capabilities || [],
      supportingMediaUrl: recoveryPlan.supportingMediaUrl || assetUrl('assets/placeholder.gif'),
    },
    compliance: {
      ...compliance,
      dataSourceLine: compliance.dataSourceLine || '',
      disclaimerShort: compliance.disclaimerShort || '',
      disclaimerLong: compliance.disclaimerLong || '',
      allowedClaims: compliance.allowedClaims || [],
    },
    branding: raw.branding,
  };
}

export function resolveBusinessLogo(data: AuditData): string {
  return data.business.logoUrl || data.branding?.clientLogoUrl || data.branding?.logoWordmarkUrl || '';
}

export function resolveHeroImage(data: AuditData): string {
  return data.business.heroImageUrl || data.branding?.clientLogoUrl || data.business.logoUrl || '';
}

export function formatAuditCurrency(data: AuditData, amount: number): string {
  const symbol = data.auditMeta?.currencySymbol || '$';
  const locale = data.auditMeta?.locale || 'en-US';
  return `${symbol}${amount.toLocaleString(locale)}`;
}

export function formatAuditRange(min: number, max: number): string {
  return `${min}-${max}`;
}
