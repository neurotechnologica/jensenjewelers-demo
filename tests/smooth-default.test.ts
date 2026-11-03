import { describe, expect, it } from 'vitest';
import { computeRingPose, smoothPose, type Landmark } from '../lib/hand-pose';

// RingTryOn calls smoothPose(prev, raw) with NO alpha, so the default (0.45) is what users get. Floor Watch's mutant that raised it to 0.9
// survived because no test used the default; this pins it.
const W = 1280;
const H = 720;
const hand = (dx = 0): Landmark[] =>
  Array.from({ length: 21 }, (_, i) => ({ x: 0.5 + dx + (i % 5) * 0.01, y: 0.3 + Math.floor(i / 5) * 0.12, z: 0 }));

describe('smoothPose default alpha', () => {
  it('is 0.45: one default step moves 45% of the way (not raw, not frozen)', () => {
    const a = computeRingPose(hand(0), W, H, 'Right');
    const b = computeRingPose(hand(0.1), W, H, 'Right');
    expect(a && b).toBeTruthy();
    const withDefault = smoothPose(a, b!);
    const explicit = smoothPose(a, b!, 0.45);
    expect(withDefault.position).toEqual(explicit.position);
    expect(withDefault.pxPerMm).toBeCloseTo(a!.pxPerMm + (b!.pxPerMm - a!.pxPerMm) * 0.45, 9);
    const t = (withDefault.position[0] - a!.position[0]) / (b!.position[0] - a!.position[0]);
    expect(t).toBeCloseTo(0.45, 6);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.6);
  });
});
