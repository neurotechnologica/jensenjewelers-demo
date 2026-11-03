/**
 * Price display for South African stores. List prices in constants.tsx are USD. We do not invent a ZAR price list:
 * - a South African store (audit currencyCode ZAR, or demo country +27) sees "Quote in ZAR" next to every USD figure;
 * - if the owner sets VITE_ZAR_PER_USD (e.g. 18.5) an indicative "about R…" figure is shown as well, clearly marked as an estimate.
 */
export interface ZarContext { isZar: boolean; rate: number | null }

export const isSouthAfricanStore = (a: { currencyCode?: string | null; phoneCountryDefault?: string | null } | undefined | null): boolean =>
  !!a && (String(a.currencyCode || '').toUpperCase() === 'ZAR' || a.phoneCountryDefault === '+27');

export function zarRateFromEnv(raw: string | undefined | null): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 5 && n <= 100 ? n : null; // sanity band so a typo cannot show silly prices
}

/** "about R9 200" (rounded to the nearest R100 so it reads as an estimate) */
export function indicativeZar(usd: number, rate: number): string {
  const rand = Math.round((usd * rate) / 100) * 100;
  return `about R${rand.toLocaleString('en-ZA').replace(/\u00a0/g, ' ')}`;
}

/** Short note shown under a USD figure. Empty for non-ZA stores. */
export function zarNote(ctx: ZarContext, usd: number, suffix = ''): string {
  if (!ctx.isZar) return '';
  return ctx.rate ? `${indicativeZar(usd, ctx.rate)}${suffix} (estimate) · final quote in ZAR` : 'Quote in ZAR';
}
