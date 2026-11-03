import { AUDIT_CONTENT_URL, PLACEHOLDER_BUSINESS_NAME } from './audit-content';
import type { AuditData } from '../types/audit';

/**
 * Fields the lead gate may show before a lead exists. Anything else in content.json
 * (loss model, call mix, recovery plan, review quotes) stays off the page until submit.
 */
export interface AuditGateBrief {
  businessName: string;
  location: string;
  preparedForLabel: string;
  currencyCode: string;
  /** Present only when the prefix actually contained it. The form still defaults the picker to +27. */
  phoneCountryDefault?: string;
}

/** First slice of content.json: auditMeta + business, before reviews / revenue. */
export const GATE_RANGE = 'bytes=0-599';

export const GATE_FALLBACK: AuditGateBrief = {
  businessName: PLACEHOLDER_BUSINESS_NAME,
  location: 'City, State',
  preparedForLabel: 'Specially Prepared for',
  currencyCode: 'USD',
};

const REPORT_KEYS = [
  'traffic',
  'callModel',
  'revenueModel',
  'breakdown',
  'comparison',
  'projection90d',
  'recoveryPlan',
  'reviews',
] as const;

function jsonString(source: string, key: string): string | undefined {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const hit = re.exec(source);
  if (!hit) return undefined;
  return hit[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/** Pull gate fields out of a (possibly truncated) content.json prefix. Null if the name or city is not in this slice. */
export function parseGatePrefix(source: string): AuditGateBrief | null {
  const businessName = jsonString(source, 'name');
  const location = jsonString(source, 'location');
  if (!businessName || !location) return null;
  const phone = jsonString(source, 'phoneCountryDefault');
  return {
    businessName,
    location,
    preparedForLabel: jsonString(source, 'preparedForLabel') || GATE_FALLBACK.preparedForLabel,
    currencyCode: jsonString(source, 'currencyCode') || 'USD',
    ...(phone ? { phoneCountryDefault: phone } : {}),
  };
}

export function briefFromAudit(data: Pick<AuditData, 'business' | 'auditMeta' | 'liveDemo'> | null | undefined): AuditGateBrief | null {
  const name = data?.business?.name?.trim();
  const location = data?.business?.location?.trim();
  if (!name || !location) return null;
  const phone = data?.liveDemo?.phoneCountryDefault?.trim();
  return {
    businessName: name,
    location,
    preparedForLabel: data?.auditMeta?.preparedForLabel || GATE_FALLBACK.preparedForLabel,
    currencyCode: data?.auditMeta?.currencyCode || 'USD',
    ...(phone ? { phoneCountryDefault: phone } : {}),
  };
}

/** Copy held in React on the long page. Report sections are omitted so they are not on the tree. */
export function withoutReport(data: AuditData): AuditData {
  const copy: AuditData = { ...data };
  const bag = copy as unknown as Record<string, unknown>;
  for (const key of REPORT_KEYS) delete bag[key];
  return copy;
}

/**
 * Name, city, and currency only. Uses a byte range so the report body is not downloaded
 * with the gate. A full GET /content.json happens only after a sent lead.
 */
export async function loadAuditGateBrief(): Promise<AuditGateBrief> {
  const response = await fetch(AUDIT_CONTENT_URL, {
    cache: 'no-store',
    headers: { Range: GATE_RANGE },
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to load audit gate (${response.status})`);
  }
  const brief = parseGatePrefix(await response.text());
  if (!brief) throw new Error('Audit gate prefix did not include the showroom name');
  return brief;
}
