/**
 * Temporal filter for the try-on ring pose (pure math, no three.js, unit-tested).
 *
 *  - One-Euro filter on position (in ring-diameters, so it is resolution independent) and on log-scale.
 *  - Rotation as a QUATERNION: adaptive slerp (One-Euro style, cutoff grows with angular speed); no Euler angles anywhere, so no gimbal
 *    flips and no 180 degree wraps.
 *  - Soft deadband (shrinks the error by a threshold instead of freezing, so no stair-stepping) on position, rotation and scale.
 *  - Jump gating: a single-frame teleport is held back until a second consistent frame confirms it.
 *  - Missing frames: hold the last pose for HOLD_MS, then hide; after a long gap the filter resets (no sweep from the old pose).
 *  - Handedness: majority vote with hysteresis over the last frames (a flickering label used to flip the ring upside down).
 */
import type { RingPose, Vec3 } from './hand-pose';
import { norm } from './hand-pose';

export type Quat = [number, number, number, number]; // x y z w

export const RING_DIAMETER_MM = 22;
export const FILTER_DEFAULTS = {
  posMinCutoff: 0.5, // Hz at rest
  posBeta: 0.4, // cutoff growth per (ring diameter / s)
  rotMinCutoff: 0.8, // Hz at rest
  rotBeta: 0.6, // cutoff growth per (rad / s)
  scaleMinCutoff: 0.6,
  dCutoff: 2,
  posDeadbandMm: 0.5,
  rotDeadbandDeg: 0.8,
  scaleDeadbandPct: 1.5,
  holdMs: 450,
  resetGapMs: 700,
  jumpDiameters: 2.5, // a per-frame move bigger than 2.5 ring diameters is suspicious until confirmed
};

const TWO_PI = Math.PI * 2;
export const alphaFor = (cutoffHz: number, dt: number) => {
  const tau = 1 / (TWO_PI * Math.max(cutoffHz, 1e-3));
  return 1 / (1 + tau / Math.max(dt, 1e-4));
};
/** Shrink |e| by db (keeps sign). */
export const softDeadband = (e: number, db: number) => (Math.abs(e) <= db ? 0 : e - Math.sign(e) * db);

// ---- quaternion helpers -------------------------------------------------
export const qDot = (a: Quat, b: Quat) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
export const qConj = (a: Quat): Quat => [-a[0], -a[1], -a[2], a[3]];
export const qMul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qNorm = (a: Quat): Quat => {
  const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l, a[3] / l];
};
/** Angle (rad) of the shortest rotation between two unit quaternions. */
export const qAngle = (a: Quat, b: Quat) => 2 * Math.acos(Math.min(1, Math.abs(qDot(a, b))));
export function qSlerp(a: Quat, b0: Quat, t: number): Quat {
  let b = b0;
  let d = qDot(a, b);
  if (d < 0) {
    b = [-b[0], -b[1], -b[2], -b[3]];
    d = -d;
  }
  if (d > 0.9995) return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
  const th = Math.acos(d);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
}
/** Rotation whose columns are x,y,z (right-handed orthonormal basis) -> quaternion. */
export function basisToQuat(x: Vec3, y: Vec3, z: Vec3): Quat {
  const m00 = x[0], m10 = x[1], m20 = x[2];
  const m01 = y[0], m11 = y[1], m21 = y[2];
  const m02 = z[0], m12 = z[1], m22 = z[2];
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return qNorm(q);
}
export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

/** The pose as the overlay uses it: holder basis z = band axis, y = dorsal (stone), x = y cross z. */
export function poseToQuat(pose: Pick<RingPose, 'axis' | 'dorsal'>): Quat {
  const z = norm(pose.axis);
  let y = norm(pose.dorsal);
  const x = norm([y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]]);
  y = norm([z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]);
  return basisToQuat(x, y, z);
}

export interface FilteredPose {
  position: Vec3;
  quat: Quat;
  pxPerMm: number;
  /** derived from quat (so consumers that want vectors get consistent ones) */
  axis: Vec3;
  dorsal: Vec3;
  /** true while the pose is being held after a missed detection */
  held: boolean;
}

export class PoseFilter {
  private o = { ...FILTER_DEFAULTS };
  private pos: Vec3 | null = null;
  private q: Quat | null = null;
  private logS = 0;
  private has = false;
  private lastT = 0;
  private lastSeenT = -1e9;
  private dPos: Vec3 = [0, 0, 0];
  private dRot = 0;
  private dRotV: Vec3 = [0, 0, 0];
  private pending: { position: Vec3; t: number } | null = null;
  rejectedJumps = 0;
  holds = 0;
  resets = 0;

  constructor(opts: Partial<typeof FILTER_DEFAULTS> = {}) {
    this.o = { ...FILTER_DEFAULTS, ...opts };
  }

  reset() {
    this.pos = null;
    this.q = null;
    this.has = false;
    this.pending = null;
    this.dPos = [0, 0, 0];
    this.dRot = 0;
    this.dRotV = [0, 0, 0];
  }

  private out(held: boolean): FilteredPose | null {
    if (!this.has || !this.pos || !this.q) return null;
    return {
      position: [...this.pos] as Vec3,
      quat: [...this.q] as Quat,
      pxPerMm: Math.exp(this.logS),
      axis: quatRotate(this.q, [0, 0, 1]),
      dorsal: quatRotate(this.q, [0, 1, 0]),
      held,
    };
  }

  /** @param raw pose of this frame or null when no hand was detected; @param tMs frame timestamp (ms) */
  update(raw: RingPose | null, tMs: number): FilteredPose | null {
    const o = this.o;
    if (!raw) {
      if (this.has && tMs - this.lastSeenT <= o.holdMs) {
        this.holds += 1;
        return this.out(true);
      }
      if (this.has) this.reset();
      return null;
    }
    const rq = poseToQuat(raw);
    const rawLogS = Math.log(Math.max(raw.pxPerMm, 1e-6));
    if (!this.has || tMs - this.lastSeenT > o.resetGapMs) {
      if (this.has) this.resets += 1;
      this.pos = [...raw.position] as Vec3;
      this.q = rq;
      this.logS = rawLogS;
      this.has = true;
      this.lastT = tMs;
      this.lastSeenT = tMs;
      this.dPos = [0, 0, 0];
      this.dRot = 0;
      this.dRotV = [0, 0, 0];
      this.pending = null;
      return this.out(false);
    }
    const dt = Math.max((tMs - this.lastT) / 1000, 1e-3);
    const pos = this.pos as Vec3;
    const q = this.q as Quat;
    const ringPx = RING_DIAMETER_MM * Math.exp(this.logS); // ring diameter in image px at the current scale

    // jump gating: a lone teleport is held until the next frame agrees with it
    const step = Math.hypot(raw.position[0] - pos[0], raw.position[1] - pos[1], raw.position[2] - pos[2]) / ringPx;
    if (step > o.jumpDiameters * Math.max(1, dt * 30)) {
      const p = this.pending;
      const agrees = p && Math.hypot(raw.position[0] - p.position[0], raw.position[1] - p.position[1], raw.position[2] - p.position[2]) / ringPx < o.jumpDiameters * 0.5;
      if (!agrees) {
        this.pending = { position: [...raw.position] as Vec3, t: tMs };
        this.rejectedJumps += 1;
        this.lastSeenT = tMs; // still "seen", keep holding the old pose
        this.lastT = tMs;
        return this.out(true);
      }
      // confirmed: accept the new location without sweeping across the screen
      this.pos = [...raw.position] as Vec3;
      this.q = rq;
      this.logS = rawLogS;
      this.pending = null;
      this.lastT = tMs;
      this.lastSeenT = tMs;
      this.dPos = [0, 0, 0];
      this.dRot = 0;
      this.dRotV = [0, 0, 0];
      return this.out(false);
    }
    this.pending = null;

    // position (One-Euro on ring-diameter units, soft deadband in mm)
    const dbPx = o.posDeadbandMm * Math.exp(this.logS);
    const newPos: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const e = softDeadband(raw.position[i] - pos[i], dbPx);
      const target = pos[i] + e;
      // SIGNED velocity (diameters / s) low-passed first, magnitude after: white noise averages out, real motion does not. (Filtering the
      // magnitude, as a naive One-Euro does per axis, treats noise as speed, raises the cutoff and lets the jitter through.)
      const vel = (target - pos[i]) / dt / ringPx;
      this.dPos[i] = this.dPos[i] + (vel - this.dPos[i]) * alphaFor(o.dCutoff, dt);
    }
    const speedP = Math.hypot(this.dPos[0], this.dPos[1], this.dPos[2]);
    const fcP = o.posMinCutoff + o.posBeta * speedP;
    const aP = alphaFor(fcP, dt);
    for (let i = 0; i < 3; i++) {
      const target = pos[i] + softDeadband(raw.position[i] - pos[i], dbPx);
      newPos[i] = pos[i] + (target - pos[i]) * aP;
    }
    this.pos = newPos;

    // rotation (quaternion, adaptive slerp, soft deadband in degrees)
    const ang = qAngle(q, rq);
    const dbRad = (o.rotDeadbandDeg * Math.PI) / 180;
    const eff = softDeadband(ang, dbRad);
    if (eff > 0 && ang > 1e-6) {
      const tgt = qSlerp(q, rq, eff / ang);
      // signed angular velocity as a world-frame rotation vector, low-passed, then its magnitude drives the cutoff
      const dq = qMul(qConj(q), tgt); // local-frame delta
      const sgn = dq[3] < 0 ? -1 : 1;
      const half = Math.min(1, Math.hypot(dq[0], dq[1], dq[2]));
      const th = 2 * Math.asin(half);
      const k = half > 1e-9 ? (sgn * th) / half / dt : 0;
      const ad = alphaFor(o.dCutoff, dt);
      for (let i = 0; i < 3; i++) this.dRotV[i] += (dq[i] * k - this.dRotV[i]) * ad;
      this.dRot = Math.hypot(this.dRotV[0], this.dRotV[1], this.dRotV[2]);
      const fc = o.rotMinCutoff + o.rotBeta * this.dRot;
      this.q = qSlerp(q, tgt, alphaFor(fc, dt));
    } else {
      this.dRot *= 0.5;
      for (let i = 0; i < 3; i++) this.dRotV[i] *= 0.5;
    }

    // scale (log domain, strong, deadband in percent)
    const eS = softDeadband(rawLogS - this.logS, o.scaleDeadbandPct / 100);
    this.logS += eS * alphaFor(o.scaleMinCutoff, dt);

    this.lastT = tMs;
    this.lastSeenT = tMs;
    return this.out(false);
  }
}

/** Majority vote with hysteresis over the MediaPipe handedness label (it flickers on some frames). */
export class HandSideVote {
  private buf: { side: 1 | -1; w: number }[] = [];
  private cur: 'Left' | 'Right' | undefined;
  constructor(private size = 20, private switchRatio = 0.7, private minSamples = 6) {}
  push(label: string | undefined, score = 1): 'Left' | 'Right' | undefined {
    if (label !== 'Left' && label !== 'Right') return this.cur;
    this.buf.push({ side: label === 'Right' ? 1 : -1, w: Math.max(score, 0.05) });
    if (this.buf.length > this.size) this.buf.shift();
    const total = this.buf.reduce((a, b) => a + b.w, 0);
    const right = this.buf.reduce((a, b) => a + (b.side === 1 ? b.w : 0), 0) / total;
    if (!this.cur) {
      this.cur = right >= 0.5 ? 'Right' : 'Left';
    } else if (this.buf.length >= this.minSamples) {
      if (this.cur === 'Left' && right >= this.switchRatio) this.cur = 'Right';
      else if (this.cur === 'Right' && 1 - right >= this.switchRatio) this.cur = 'Left';
    }
    return this.cur;
  }
  reset() {
    this.buf = [];
    this.cur = undefined;
  }
}
