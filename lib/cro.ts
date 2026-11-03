import type { AuditData } from '../types/audit';
import { resolveCalUrl } from './prospect-fixes';

/**
 * Short prospect page ("CRO" page) flags and copy.
 *
 * Truthfulness: today the offer is "free audit + done-for-you setup, live within days" (founder-assisted, see
 * fourcee-onboarding-audit/REPORT.md P0.4). "Go live in 5 minutes" is only allowed behind VITE_VOICE_ONBOARDING=1,
 * i.e. once the voice onboarding platform exists. The number of days stays generic until TK confirms capacity.
 */
export const OFFER_LINE = 'Free audit · done-for-you setup · live within days';

export type CtaVariant = 'book' | 'hear' | 'golive';

const env = import.meta.env;

/** True when `/` (no hash route) should render the short page. `?v=full` / `?v=short` override the build flag (A/B from the email link). */
export function wantsShortPage(loc: Pick<Location, 'hash' | 'search'> = window.location): boolean {
  const raw = (loc.hash || '').replace(/^#/, '').replace(/^\/+/, '');
  const head = raw.split('/')[0].split('?')[0].toLowerCase();
  if (head !== '') return false; // any hash route (#/audit, #/checkout, #/home ...) is the existing app
  const v = new URLSearchParams(loc.search).get('v');
  if (v === 'full') return false;
  if (v === 'short') return true;
  return env.VITE_CRO_SHORT !== '0';
}

export function resolveCtaVariant(search: string = typeof window !== 'undefined' ? window.location.search : ''): CtaVariant {
  const q = new URLSearchParams(search).get('cta');
  const want = (q || env.VITE_CRO_CTA || 'book').toLowerCase();
  if (want === 'golive') {
    // never show "Go live in 5 minutes" unless the platform flag AND a destination are set
    return env.VITE_VOICE_ONBOARDING === '1' && env.VITE_ONBOARDING_URL ? 'golive' : 'book';
  }
  return want === 'hear' ? 'hear' : 'book';
}

export const CTA_LABEL: Record<CtaVariant, string> = {
  book: 'Book my free audit walkthrough',
  hear: 'Hear your AI receptionist in 60 seconds',
  golive: 'Go live in 5 minutes',
};

/** Booking link. An http(s) VITE_CAL_BOOKING_URL or VITE_BOOKING_URL overrides the Google appointment page. */
export function bookingUrl(): string {
  return resolveCalUrl(import.meta.env as { VITE_CAL_BOOKING_URL?: string; VITE_BOOKING_URL?: string });
}

export function onboardingUrl(): string {
  return env.VITE_ONBOARDING_URL || '';
}

export interface ProofNumbers {
  lossMin: number;
  lossMax: number;
  missedMin: number;
  missedMax: number;
  inboundMin: number;
  inboundMax: number;
  answerMin: number;
  answerMax: number;
  rating: number | null;
  reviews: number | null;
}

const num = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null);

/** Reads only existing content.json keys. Returns null for the loss headline when the audit has no usable numbers. */
export function readProof(d: AuditData): ProofNumbers | null {
  const lossMin = num(d.revenueModel?.monthlyLossMin);
  const lossMax = num(d.revenueModel?.monthlyLossMax);
  if (lossMin === null || lossMax === null || lossMax <= 0) return null;
  return {
    lossMin,
    lossMax,
    missedMin: num(d.callModel?.missedCallsPerWeekMin) ?? 0,
    missedMax: num(d.callModel?.missedCallsPerWeekMax) ?? 0,
    inboundMin: num(d.callModel?.inboundCallsPerWeekMin) ?? 0,
    inboundMax: num(d.callModel?.inboundCallsPerWeekMax) ?? 0,
    answerMin: num(d.callModel?.answerRateMin) ?? 0,
    answerMax: num(d.callModel?.answerRateMax) ?? 0,
    rating: num(d.reviews?.rating),
    reviews: num(d.reviews?.count),
  };
}

/** E.164 for the demo-call webhook. Drops spaces/punctuation and the national trunk 0 (SA "082..." -> +2782...). */
export function toE164(countryCode: string, input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 7 || digits.length > 12) return null;
  return `${countryCode}${digits}`;
}
