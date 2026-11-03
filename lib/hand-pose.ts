/**
 * Ring pose from MediaPipe hand landmarks (21 points). Pure math so it can be unit tested without a camera.
 *
 * Ring finger: 13 = MCP (knuckle), 14 = PIP (middle joint). A ring sits on the proximal phalanx, a little
 * closer to the knuckle than the middle joint. Everything is returned in a Y-up, Z-toward-camera frame whose
 * unit is the SOURCE PIXEL (x right, y up, origin at the image centre) so an orthographic camera can match it.
 */
export interface Landmark { x: number; y: number; z: number }
export type Vec3 = [number, number, number];

export interface RingPose {
  position: Vec3;     // px
  axis: Vec3;         // unit vector along the finger (ring band axis)
  dorsal: Vec3;       // unit vector pointing out of the back of the hand, perpendicular to axis
  pxPerMm: number;    // image pixels per real millimetre at the finger
  fingerAngleDeg: number;
}

/** Average adult dimensions (mm) used only to turn landmark distances into a scale. */
const REF_MM = { ringProximal: 43, wristToMiddleMcp: 98, indexToPinkyMcp: 72 };
const RING_POSITION_ALONG_PROXIMAL = 0.42;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function landmarkToPx(l: Landmark, width: number, height: number): Vec3 {
  return [l.x * width - width / 2, -(l.y * height - height / 2), -l.z * width];
}

/**
 * @param handedness label MediaPipe reported ("Left" | "Right") for the UNMIRRORED frame we fed it. With tasks-vision >= 0.10.5 the
 *   label is the real hand ('Right' = right hand). Needed only to decide which side of the hand is the back (see comment in the body).
 */
export function computeRingPose(lm: Landmark[], width: number, height: number, handedness: string | undefined): RingPose | null {
  if (!lm || lm.length < 21) return null;
  const P = (i: number) => landmarkToPx(lm[i], width, height);
  const mcp = P(13);
  const pip = P(14);
  const proximal = sub(pip, mcp);
  const proximalLen = len(proximal);
  if (proximalLen < 4) return null;
  const axis = norm(proximal);
  const position = add(mcp, mul(proximal, RING_POSITION_ALONG_PROXIMAL));

  const pxPerMm =
    (proximalLen / REF_MM.ringProximal + len(sub(P(9), P(0))) / REF_MM.wristToMiddleMcp + len(sub(P(5), P(17))) / REF_MM.indexToPinkyMcp) / 3;

  // Palm plane normal. For a REAL right hand, n = (indexMCP - wrist) x (pinkyMCP - wrist) points out of the palm
  // (verified by hand: right hand, palm to camera, index image-right, pinky image-left -> n.z > 0); for a real left hand it
  // points out of the back.
  //
  // HANDEDNESS LABEL CONVENTION (this was the "ring upside down" bug): the legacy MediaPipe Hands docs say the label assumes a
  // MIRRORED selfie image and must be swapped for normal frames. @mediapipe/tasks-vision >= 0.10.5 ("Swap left and right hand labels")
  // already does that: the label now describes the hand as it LOOKS in the frame we feed it. Our frames are never mirrored (the stream
  // is raw; the front camera is only mirrored by CSS for display), so label 'Right' == a real right hand. The old code treated 'Left'
  // as the real right hand, which put the stone on the PALM side of every finger (hidden behind the occluder / ring looked upside down).
  // Measured on the bundled victory.jpg (palm to camera, index image-right, curled fingertips nearer the camera than the knuckles =>
  // real right hand): the model returns 'Right' (score 0.995). See tests/pose.test.ts + PR evidence.
  let n = norm(cross(sub(P(5), P(0)), sub(P(17), P(0))));
  const realRight = handedness === 'Right';
  n = mul(n, realRight ? -1 : 1); // -> always out of the BACK of the hand
  // make perpendicular to the finger axis
  let dorsal = sub(n, mul(axis, dot(n, axis)));
  if (len(dorsal) < 1e-3) dorsal = [0, 0, 1];
  dorsal = norm(dorsal);

  return {
    position,
    axis,
    dorsal,
    pxPerMm,
    fingerAngleDeg: (Math.atan2(axis[1], axis[0]) * 180) / Math.PI,
  };
}

/** Legacy single-step exponential smoothing (kept for photo/unit use). The live camera path uses PoseFilter (lib/pose-filter.ts). alpha 0 = frozen, 1 = raw. */
export function smoothPose(prev: RingPose | null, next: RingPose, alpha = 0.45): RingPose {
  if (!prev) return next;
  const lerp = (a: Vec3, b: Vec3): Vec3 => [a[0] + (b[0] - a[0]) * alpha, a[1] + (b[1] - a[1]) * alpha, a[2] + (b[2] - a[2]) * alpha];
  return {
    position: lerp(prev.position, next.position),
    axis: norm(lerp(prev.axis, next.axis)),
    dorsal: norm(lerp(prev.dorsal, next.dorsal)),
    pxPerMm: prev.pxPerMm + (next.pxPerMm - prev.pxPerMm) * alpha,
    fingerAngleDeg: next.fingerAngleDeg,
  };
}
