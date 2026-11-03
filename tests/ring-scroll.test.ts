import { describe, expect, it } from 'vitest';
import { ringPixelRatio, RING_DOCK_AT, RING_HUD_AT, RING_HUD_AT_NOT_READY, clamp01, hudVisible, isDocked, ringProgress } from '../lib/ring-scroll';
import { splashTrioLayout } from '../lib/splash-layout';
import { AMOUNTX, AMOUNTY, dotHeight, dottedFrameInterval, dottedPixelRatio } from '../lib/dotted-renderer';

describe('ring scroll progress', () => {
  it('0 before the section, 1 after it, linear in between (sticky range = section - viewport)', () => {
    expect(ringProgress(300, 1266, 844)).toBe(0);
    expect(ringProgress(0, 1266, 844)).toBe(0);
    expect(ringProgress(-211, 1266, 844)).toBeCloseTo(0.5, 6);
    expect(ringProgress(-422, 1266, 844)).toBe(1);
    expect(ringProgress(-5000, 1266, 844)).toBe(1);
  });
  it('degenerate sizes do not NaN', () => { expect(Number.isFinite(ringProgress(-10, 100, 100))).toBe(true); expect(clamp01(NaN)).toBe(0); });
  it('HUD appears early when the scene is not ready, and never later than the camera dock', () => {
    expect(hudVisible(RING_HUD_AT_NOT_READY, false)).toBe(true);
    expect(hudVisible(RING_HUD_AT_NOT_READY, true)).toBe(false);
    expect(hudVisible(RING_HUD_AT, true)).toBe(true);
    expect(RING_HUD_AT).toBeLessThan(RING_DOCK_AT);
    expect(isDocked(RING_DOCK_AT)).toBe(true);
    expect(isDocked(RING_DOCK_AT - 0.01)).toBe(false);
  });
  it('HUD is visible for every progress >= 0.5 regardless of scene state (a fast fling cannot skip it)', () => {
    for (let p = 0.5; p <= 1; p += 0.05) { expect(hudVisible(p, true)).toBe(true); expect(hudVisible(p, false)).toBe(true); }
  });
});

describe('pixel ratio caps', () => {
  it('phones: ring 1.5, dots 1.25; desktop: 2', () => {
    expect(ringPixelRatio(3, true)).toBe(1.5); expect(ringPixelRatio(3, false)).toBe(2); expect(ringPixelRatio(1, true)).toBe(1); expect(ringPixelRatio(0, true)).toBe(1);
    expect(dottedPixelRatio(3, true)).toBe(1.25); expect(dottedPixelRatio(3, false)).toBe(2);
  });
  it('dots run at 30 fps on phones', () => { expect(dottedFrameInterval(true)).toBeCloseTo(33.3, 1); expect(dottedFrameInterval(false)).toBeCloseTo(16.7, 1); });
  it('wave is bounded and deterministic', () => {
    for (let ix = 0; ix < AMOUNTX; ix++) for (let iy = 0; iy < AMOUNTY; iy++) expect(Math.abs(dotHeight(ix, iy, 3.3))).toBeLessThanOrEqual(84);
    expect(dotHeight(3, 4, 1)).toBe(dotHeight(3, 4, 1));
  });
});

describe('splash trio layout', () => {
  it('fills a phone screen (>= 340 px of a 390 px viewport) and never overflows it, at common phone widths', () => {
    for (const vw of [320, 360, 375, 390, 412, 430, 480, 600]) {
      const { scale } = splashTrioLayout(vw);
      const stackW = 448 * scale;
      expect(stackW).toBeLessThanOrEqual(vw - 24 + 0.5);
      if (vw >= 390) expect(stackW).toBeGreaterThanOrEqual(Math.min(vw - 24, 448) * 0.99 - 1);
    }
    expect(splashTrioLayout(390).scale).toBeGreaterThan(0.78); // was 0.52 before
  });
  it('re-centres the stack: shift = -96 px * scale', () => { const l = splashTrioLayout(390); expect(l.shiftPx).toBeCloseTo(-96 * l.scale, 1); });
  it('tablet / desktop widths stay capped', () => { expect(splashTrioLayout(768).scale).toBeLessThanOrEqual(0.9); expect(splashTrioLayout(1440).scale).toBeLessThanOrEqual(0.9); });
});
