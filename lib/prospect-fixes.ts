/**
 * Prospect-facing display helpers for the fix sprint.
 * Does not rename or rewrite Neuro injection slots (business name, city/state, report id token).
 */

export const TEMPLATE_AUDIT_DATE = 'April 15, 2026';

export const SIDE_DEAL_MIN = 1000;
export const SIDE_DEAL_MAX = 20000;
export const SIDE_DEAL_STEP = 250;
/** On the step grid. 4200 is not (step 250 from 1000), so the thumb snapped to 4250 while the label stayed $4,200. */
export const SIDE_DEAL_DEFAULT = 4250;

export function snapDeal(n: number): number {
  if (!Number.isFinite(n)) return SIDE_DEAL_DEFAULT;
  const snapped = Math.round((n - SIDE_DEAL_MIN) / SIDE_DEAL_STEP) * SIDE_DEAL_STEP + SIDE_DEAL_MIN;
  return Math.min(SIDE_DEAL_MAX, Math.max(SIDE_DEAL_MIN, snapped));
}

/** Payback in months. Monthly benefit vs the first-month plan cost. Non-positive benefit → Infinity. */
export function paybackMonths(monthlyBenefit: number, monthlyCost = 997): number {
  if (!(monthlyBenefit > 0) || !(monthlyCost > 0)) return Infinity;
  return monthlyCost / monthlyBenefit;
}

/**
 * Never render "0.0". Sub-month payback reads as "under 1".
 * Cap a long tail so a tiny benefit cannot print an absurd month count.
 */
export function formatRoiMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '—';
  if (months < 1) return 'under 1';
  if (months > 36) return '36+';
  const rounded = Math.round(months * 10) / 10;
  if (rounded < 1) return 'under 1';
  return rounded.toFixed(1);
}

/** Full badge. "under 1" is singular ("month"), never "0.0 months" or "under 1 months". */
export function roiMonthsPhrase(months: number): string {
  const label = formatRoiMonths(months);
  if (label === '—') return 'ROI unavailable';
  if (label === 'under 1') return 'ROI in under 1 month';
  return `ROI in ${label} months`;
}

/** The audit report opens only after the lead API accepts the form. Queued and invalid stay on the gate. */
export function leadSubmitUnlocksReport(status: string): boolean {
  return status === 'sent';
}

export function isPlaceholderReportId(id: string | undefined | null): boolean {
  const t = (id || '').trim();
  if (!t) return true;
  return t.toUpperCase() === 'PLACEHOLDER';
}

/** Visit date when the template sentinel is still in content.json. A real injected date is kept. */
export function visitAuditDate(stored: string | undefined | null, now = new Date()): string {
  const value = (stored || '').trim();
  if (value && value !== TEMPLATE_AUDIT_DATE) return value;
  return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** One duration mention. Drops a second "~60–90s" when helper copy already includes it. */
export function demoDurationLine(helper?: string | null, hint?: string | null): string {
  const h = (helper || '').trim();
  const d = (hint || '').trim();
  if (!d) return h;
  if (!h) return d;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(h).includes(norm(d))) return h;
  return `${h} ${d}`.replace(/\s+/g, ' ').trim();
}

export function formatUsdAddon(amount: number): string {
  return `+$${amount.toLocaleString('en-US')}`;
}

/** Founder Google Calendar appointment page. Shown unless an http(s) env override is set. */
export const DEFAULT_BOOKING_URL = 'https://calendar.app.google/Ra2fzveKj33ZqbAG9';

function httpBookingUrl(value: string | undefined): string {
  const raw = (value || '').trim();
  return /^https?:\/\//i.test(raw) ? raw : '';
}

/** http(s) booking link. VITE_CAL_BOOKING_URL wins, then VITE_BOOKING_URL, otherwise the Google appointment page. */
export function resolveCalUrl(env: { VITE_CAL_BOOKING_URL?: string; VITE_BOOKING_URL?: string } | undefined | null): string {
  return httpBookingUrl(env?.VITE_CAL_BOOKING_URL) || httpBookingUrl(env?.VITE_BOOKING_URL) || DEFAULT_BOOKING_URL;
}

export function configuredCalUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { VITE_CAL_BOOKING_URL?: string; VITE_BOOKING_URL?: string } }).env;
  return resolveCalUrl(env);
}
