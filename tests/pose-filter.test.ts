import { describe, expect, it } from 'vitest';
import { computeRingPose, type Landmark, type RingPose } from '../lib/hand-pose';
import { FILTER_DEFAULTS, HandSideVote, PoseFilter, alphaFor, basisToQuat, poseToQuat, qAngle, qSlerp, quatRotate, softDeadband, type Quat } from '../lib/pose-filter';

const W = 1000, H = 1000;
function hand(): Landmark[] {
  const px: [number, number][] = Array(21).fill([500, 500]);
  px[0] = [500, 900]; px[5] = [680, 600]; px[17] = [320, 600]; px[9] = [500, 410]; px[13] = [430, 420]; px[14] = [430, 205];
  return px.map(([x, y]) => ({ x: x / W, y: y / H, z: 0 }));
}
// small deterministic PRNG so the tests are stable
function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2; }
const basePose = (): RingPose => computeRingPose(hand(), W, H, 'Left')!;
const noisy = (p: RingPose, r: () => number, posPx: number, rotRad: number, scale: number): RingPose => {
  const ax = p.axis, dd = p.dorsal;
  const tilt = (v: [number, number, number]): [number, number, number] => { const a = r() * rotRad; return [v[0] + a, v[1] + r() * rotRad, v[2]]; };
  const n = (v: [number, number, number]) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l] as [number, number, number]; };
  return { ...p, position: [p.position[0] + r() * posPx, p.position[1] + r() * posPx, p.position[2] + r() * posPx], axis: n(tilt(ax)), dorsal: n(tilt(dd)), pxPerMm: p.pxPerMm * (1 + r() * scale) };
};
const rms = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / a.length);

describe('quaternion helpers', () => {
  it('basisToQuat of identity is identity and rotates vectors correctly', () => {
    const q = basisToQuat([1, 0, 0], [0, 1, 0], [0, 0, 1]);
    expect(q.map((v) => +v.toFixed(6))).toEqual([0, 0, 0, 1]);
    const r = poseToQuat({ axis: [0, 1, 0], dorsal: [0, 0, 1] }); // band axis (+z of the ring) -> image up, stone (+y) -> toward camera
    const a = quatRotate(r, [0, 0, 1]); const d = quatRotate(r, [0, 1, 0]);
    expect(a[1]).toBeCloseTo(1, 6); expect(d[2]).toBeCloseTo(1, 6);
  });
  it('slerp takes the short way and keeps unit length', () => {
    const a: Quat = [0, 0, 0, 1]; const b: Quat = [0, 0, 0.9999, -0.0141]; // nearly 180deg, opposite hemisphere
    const m = qSlerp(a, b, 0.5);
    expect(Math.hypot(...m)).toBeCloseTo(1, 6);
    expect(qAngle(a, m)).toBeLessThan(qAngle(a, b));
  });
  it('softDeadband shrinks, never flips sign', () => {
    expect(softDeadband(0.3, 0.5)).toBe(0); expect(softDeadband(1, 0.5)).toBeCloseTo(0.5, 9); expect(softDeadband(-1, 0.5)).toBeCloseTo(-0.5, 9);
  });
  it('alphaFor is monotonic in cutoff and bounded', () => {
    expect(alphaFor(1, 1 / 30)).toBeLessThan(alphaFor(5, 1 / 30)); expect(alphaFor(1000, 1 / 30)).toBeLessThanOrEqual(1);
  });
});

describe('PoseFilter', () => {
  it('first frame passes through; output quaternion matches the raw orientation', () => {
    const f = new PoseFilter(); const p = basePose(); const o = f.update(p, 0)!;
    expect(o.position).toEqual(p.position);
    expect(qAngle(o.quat, poseToQuat(p))).toBeCloseTo(0, 6);
    expect(o.held).toBe(false);
  });
  it('removes jitter on a static hand: filtered step RMS is at least 4x smaller than the raw step RMS', () => {
    const f = new PoseFilter(); const r = rng(7); const p = basePose();
    const rawSteps: number[] = []; const fSteps: number[] = []; let pr: RingPose | null = null; let pf: number[] | null = null;
    for (let i = 0; i < 300; i++) {
      const raw = noisy(p, r, 4, 0.03, 0.02); const o = f.update(raw, i * 33.3)!;
      if (pr && pf) { rawSteps.push(Math.hypot(raw.position[0] - pr.position[0], raw.position[1] - pr.position[1])); fSteps.push(Math.hypot(o.position[0] - pf[0], o.position[1] - pf[1])); }
      pr = raw; pf = o.position;
    }
    expect(rms(fSteps.slice(30))).toBeLessThan(rms(rawSteps.slice(30)) / 4);
  });
  it('rotation jitter is damped and the quaternion never flips hemisphere (angle step small every frame)', () => {
    const f = new PoseFilter(); const r = rng(11); const p = basePose(); let prev: Quat | null = null; let maxStep = 0;
    for (let i = 0; i < 300; i++) { const o = f.update(noisy(p, r, 2, 0.05, 0.01), i * 33.3)!; if (prev) maxStep = Math.max(maxStep, qAngle(prev, o.quat)); prev = o.quat; }
    expect(maxStep).toBeLessThan(0.05);
  });
  it('tracks real motion with little lag: a 150 px move over 10 frames is followed to within 20 px by the end', () => {
    const f = new PoseFilter(); const p = basePose(); let o = f.update(p, 0)!;
    for (let i = 1; i <= 10; i++) o = f.update({ ...p, position: [p.position[0] + 15 * i, p.position[1], p.position[2]] }, i * 33.3)!;
    for (let i = 11; i <= 20; i++) o = f.update({ ...p, position: [p.position[0] + 150, p.position[1], p.position[2]] }, i * 33.3)!;
    expect(Math.abs(o.position[0] - (p.position[0] + 150))).toBeLessThan(20);
  });
  it('holds the last pose for a few missed frames, then hides, and does not sweep after a long gap', () => {
    const f = new PoseFilter(); const p = basePose(); f.update(p, 0);
    const held = f.update(null, 100)!; expect(held.held).toBe(true); expect(held.position).toEqual(p.position);
    expect(f.update(null, FILTER_DEFAULTS.holdMs + 50)).toBeNull();
    const moved: RingPose = { ...p, position: [p.position[0] + 300, p.position[1], 0] };
    const o = f.update(moved, 5000)!; expect(o.position[0]).toBeCloseTo(moved.position[0], 6); // reacquired: snaps, no 0.3 s glide across the screen
  });
  it('a single-frame teleport is rejected, a confirmed move is accepted', () => {
    const f = new PoseFilter(); const p = basePose(); f.update(p, 0); f.update(p, 33);
    const far: RingPose = { ...p, position: [p.position[0] + 600, p.position[1], 0] };
    const o1 = f.update(far, 66)!; expect(o1.held).toBe(true); expect(o1.position[0]).toBeCloseTo(p.position[0], 3); expect(f.rejectedJumps).toBe(1);
    const o2 = f.update(far, 100)!; expect(o2.position[0]).toBeCloseTo(far.position[0], 3);
  });
  it('scale: noise within the deadband does not move it, a real 20% change converges', () => {
    const f = new PoseFilter(); const p = basePose(); f.update(p, 0);
    for (let i = 1; i < 30; i++) f.update({ ...p, pxPerMm: p.pxPerMm * (1 + (i % 2 ? 0.01 : -0.01)) }, i * 33);
    expect(f.update({ ...p, pxPerMm: p.pxPerMm }, 1000)!.pxPerMm).toBeCloseTo(p.pxPerMm, 3);
    let o = f.update({ ...p, pxPerMm: p.pxPerMm * 1.2 }, 1033)!;
    for (let i = 1; i < 90; i++) o = f.update({ ...p, pxPerMm: p.pxPerMm * 1.2 }, 1033 + i * 33)!;
    expect(o.pxPerMm / p.pxPerMm).toBeGreaterThan(1.17);
  });
  it('orientation: the filtered stone (+y of the ring) points along the dorsal vector, band axis along the finger', () => {
    const f = new PoseFilter(); const p = basePose(); const o = f.update(p, 0)!;
    const stone = quatRotate(o.quat, [0, 1, 0]); const band = quatRotate(o.quat, [0, 0, 1]);
    for (let i = 0; i < 3; i++) { expect(stone[i]).toBeCloseTo(p.dorsal[i], 5); expect(band[i]).toBeCloseTo(p.axis[i], 5); }
  });
});

describe('HandSideVote', () => {
  it('ignores a flickering label: 1 bad frame in 10 never flips the side', () => {
    const v = new HandSideVote(); let side;
    for (let i = 0; i < 40; i++) side = v.push(i % 10 === 5 ? 'Left' : 'Right', 0.9);
    expect(side).toBe('Right');
  });
  it('switches when the hand really changes (sustained >=70%)', () => {
    const v = new HandSideVote(); for (let i = 0; i < 20; i++) v.push('Right', 0.95);
    let side; for (let i = 0; i < 30; i++) side = v.push('Left', 0.95);
    expect(side).toBe('Left');
  });
  it('unknown labels keep the current side', () => { const v = new HandSideVote(); v.push('Left'); expect(v.push(undefined)).toBe('Left'); });
});
