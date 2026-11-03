import { describe, expect, it } from 'vitest';
import {
  SIDE_DEAL_DEFAULT,
  demoDurationLine,
  formatRoiMonths,
  roiMonthsPhrase,
  formatUsdAddon,
  isPlaceholderReportId,
  paybackMonths,
  leadSubmitUnlocksReport,
  DEFAULT_BOOKING_URL,
  resolveCalUrl,
  snapDeal,
  visitAuditDate,
} from '../lib/prospect-fixes';

describe('ROI display', () => {
  it('does not print 0.0 months for a sub-month payback', () => {
    const monthlyBenefit = 252600 / 12;
    const months = paybackMonths(monthlyBenefit, 997);
    expect(months).toBeGreaterThan(0);
    expect(months).toBeLessThan(0.1);
    expect(formatRoiMonths(months)).toBe('under 1');
    expect(formatRoiMonths(0.047)).toBe('under 1');
    expect(roiMonthsPhrase(months)).toBe('ROI in under 1 month');
  });

  it('caps a long payback and keeps a normal one to one decimal', () => {
    expect(formatRoiMonths(4.26)).toBe('4.3');
    expect(formatRoiMonths(48)).toBe('36+');
    expect(formatRoiMonths(0)).toBe('—');
    expect(formatRoiMonths(Infinity)).toBe('—');
  });
});

describe('side-menu deal slider', () => {
  it('snaps 4200 onto the same step the thumb uses', () => {
    expect(snapDeal(4200)).toBe(4250);
    expect(snapDeal(SIDE_DEAL_DEFAULT)).toBe(4250);
    expect(snapDeal(4250) % 250).toBe(0);
  });
});

describe('audit chips', () => {
  it('replaces the template date and hides a placeholder report id', () => {
    const shown = visitAuditDate('April 15, 2026', new Date('2026-10-10T12:00:00Z'));
    expect(shown).not.toBe('April 15, 2026');
    expect(shown).toMatch(/2026/);
    expect(visitAuditDate('March 2, 2026')).toBe('March 2, 2026');
    expect(isPlaceholderReportId('PLACEHOLDER')).toBe(true);
    expect(isPlaceholderReportId('AUD-19')).toBe(false);
  });
});

describe('demo duration and money', () => {
  it('does not repeat the duration hint', () => {
    expect(demoDurationLine('No charge. ~60–90s.', '~60–90s.')).toBe('No charge. ~60–90s.');
    expect(demoDurationLine('No charge.', '~60–90s.')).toBe('No charge. ~60–90s.');
  });
  it('formats add-on prices with a thousands separator', () => {
    expect(formatUsdAddon(1500)).toBe('+$1,500');
  });
});

describe('audit lead gate', () => {
  it('unlocks only after the server accepts the lead', () => {
    expect(leadSubmitUnlocksReport('sent')).toBe(true);
    expect(leadSubmitUnlocksReport('queued')).toBe(false);
    expect(leadSubmitUnlocksReport('invalid')).toBe(false);
  });
});

describe('booking link', () => {
  it('uses the Google appointment page unless an http(s) env override is set', () => {
    expect(resolveCalUrl({})).toBe(DEFAULT_BOOKING_URL);
    expect(resolveCalUrl(null)).toBe(DEFAULT_BOOKING_URL);
    expect(resolveCalUrl({ VITE_CAL_BOOKING_URL: '' })).toBe(DEFAULT_BOOKING_URL);
    expect(resolveCalUrl({ VITE_BOOKING_URL: 'not a url' })).toBe(DEFAULT_BOOKING_URL);
    expect(DEFAULT_BOOKING_URL).toBe('https://calendar.app.google/Ra2fzveKj33ZqbAG9');
    expect(resolveCalUrl({ VITE_CAL_BOOKING_URL: 'https://book.example/intro' })).toBe('https://book.example/intro');
    expect(resolveCalUrl({ VITE_BOOKING_URL: 'https://book.example/fallback' })).toBe('https://book.example/fallback');
    expect(resolveCalUrl({ VITE_CAL_BOOKING_URL: 'https://book.example/primary', VITE_BOOKING_URL: 'https://book.example/fallback' })).toBe('https://book.example/primary');
    expect(resolveCalUrl({ VITE_CAL_BOOKING_URL: 'javascript:alert(1)', VITE_BOOKING_URL: 'https://book.example/fallback' })).toBe('https://book.example/fallback');
  });
});
