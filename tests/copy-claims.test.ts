import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CAPABILITIES, byStatus } from '../lib/capabilities';
import { indicativeZar, isSouthAfricanStore, zarNote, zarRateFromEnv } from '../lib/pricing-display';

const read = (f: string) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
// customer-visible surfaces (the chat knowledge base and generated content.json are covered by their own PRs / the generator)
const SURFACES = ['App.tsx', 'components/CheckoutFlow.tsx', 'components/AuditPage.tsx', 'components/CRMView.tsx', 'components/ShortAudit.tsx', 'components/ui/mini-phone.tsx', 'components/ui/pricing.tsx', 'components/PricingMatrix.tsx', 'index.html'];
// Claims that are not true today (onboarding audit 2026-10-03). Add to this list rather than loosening it.
const BANNED: [RegExp, string][] = [
  [/hands[- ]?off/i, 'hands-off'],
  [/(live|go live|get live|setup|set up|deploy\w*)[^.<>{}]{0,40}(in|within|under|less than)\s+(2|two)\s*hours?/i, 'live in 2 hours'],
  [/(under|less than|within)\s+(2|two)\s*hours?/i, 'under 2 hours'],
  [/fully[- ]automatic/i, 'fully automatic'],
  [/never lose another/i, 'never lose another client'],
  [/5[- ]minute (setup|onboarding|go[- ]live)/i, '5 minute setup'],
  [/zero[- ]touch|no (human|founder) (needed|required|involved)/i, 'no human involved'],
  [/Deployment Started/i, 'Deployment Started (nothing is deployed on request)'],
];

describe('copy: no untrue claims on customer-visible surfaces', () => {
  for (const f of SURFACES) {
    it(f, () => {
      const src = read(f);
      for (const [re, name] of BANNED) expect(src.match(re), `${f} contains "${name}"`).toBeNull();
    });
  }
});

describe('real vs not-yet list', () => {
  it('has all three groups and unique ids', () => {
    expect(byStatus('live').length).toBeGreaterThan(0); expect(byStatus('setup').length).toBeGreaterThan(0); expect(byStatus('soon').length).toBeGreaterThan(0);
    expect(new Set(CAPABILITIES.map((c) => c.id)).size).toBe(CAPABILITIES.length);
  });
  it('does not present unbuilt things as live (self-serve, card payment, CRM sync, portal logs)', () => {
    for (const id of ['selfserve', 'crm', 'portal']) expect(CAPABILITIES.find((c) => c.id === id)?.status).toBe('soon');
  });
});

describe('ZAR display', () => {
  it('detects SA stores by currency or demo country', () => {
    expect(isSouthAfricanStore({ currencyCode: 'ZAR' })).toBe(true);
    expect(isSouthAfricanStore({ currencyCode: 'USD', phoneCountryDefault: '+27' })).toBe(true);
    expect(isSouthAfricanStore({ currencyCode: 'USD', phoneCountryDefault: '+1' })).toBe(false);
    expect(isSouthAfricanStore(undefined)).toBe(false);
  });
  it('quote-in-ZAR by default; indicative rand figure only with a sane rate', () => {
    expect(zarNote({ isZar: false, rate: 18 }, 497)).toBe('');
    expect(zarNote({ isZar: true, rate: null }, 497)).toBe('Quote in ZAR');
    expect(zarNote({ isZar: true, rate: 18.5 }, 497, '/mo')).toBe('about R9 200/mo (estimate) · final quote in ZAR');
    expect(indicativeZar(997, 18.5)).toBe('about R18 400');
  });
  it('rejects absurd rates', () => { expect(zarRateFromEnv('abc')).toBeNull(); expect(zarRateFromEnv('1')).toBeNull(); expect(zarRateFromEnv('999')).toBeNull(); expect(zarRateFromEnv('18.4')).toBe(18.4); expect(zarRateFromEnv(undefined)).toBeNull(); });
});
