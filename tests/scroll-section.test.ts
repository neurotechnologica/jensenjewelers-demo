import { describe, expect, it } from 'vitest';
import { landingSectionElementId, scrollTopFor } from '../lib/scroll-section';

describe('landing section scroll', () => {
  it('maps hash heads onto section ids', () => {
    expect(landingSectionElementId('demo', false)).toBe('demo');
    expect(landingSectionElementId('roi', true)).toBe('roi-calculator');
    expect(landingSectionElementId('faq', false)).toBe('signal-faq');
    expect(landingSectionElementId('ring', false)).toBe('ring-studio');
    expect(landingSectionElementId('ring', true)).toBe('ring-studio-hero');
  });

  it('places the target at the scroll-margin, and never above 0', () => {
    expect(scrollTopFor(0, 500, 200, 96)).toBe(604);
    expect(scrollTopFor(10, 0, 40, 96)).toBe(0);
  });
});
