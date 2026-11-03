import { describe, expect, it } from 'vitest';
import { planHashRoute } from '../lib/hash-route';
import { AppView } from '../types';

describe('hash routes', () => {
  it('sends the retired ops portal back to the landing home', () => {
    for (const hash of ['#/ops', '#/dashboard', '#/crm', '#/OPS']) {
      expect(planHashRoute(hash, false)).toEqual({ view: AppView.LANDING, replaceHome: true });
    }
  });

  it('keeps admin off unless the build flag is on', () => {
    expect(planHashRoute('#/admin', false)).toEqual({ view: AppView.LANDING, replaceHome: true });
    expect(planHashRoute('#/admin', true).view).toBe(AppView.ADMIN);
  });

  it('still opens the public sections', () => {
    expect(planHashRoute('#/audit', false).view).toBe(AppView.LEAD_MAGNET);
    expect(planHashRoute('#/checkout', false).view).toBe(AppView.CHECKOUT);
    expect(planHashRoute('#/roi', false)).toMatchObject({ view: AppView.LANDING, section: 'roi' });
    expect(planHashRoute('#/ring', false).section).toBe('ring');
  });
});
