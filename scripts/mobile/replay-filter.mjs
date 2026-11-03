// Offline replay: feed a recorded RAW pose trace (tryon-trace-*.json from tryon-jitter.mjs) through lib/pose-filter.ts and the legacy
// smoothPose(alpha 0.45); report jitter + tracking error. Used to tune the filter without a camera. Usage: node replay-filter.mjs trace.json [json overrides]
import fs from 'fs';
import { execSync } from 'child_process';
execSync('npx esbuild lib/pose-filter.ts --bundle --format=esm --outfile=/tmp/pf-build/pose-filter.mjs && npx esbuild lib/hand-pose.ts --bundle --format=esm --outfile=/tmp/pf-build/hand-pose.mjs', { stdio: 'ignore' });
const { PoseFilter, poseToQuat, qAngle } = await import('/tmp/pf-build/pose-filter.mjs');
const { smoothPose } = await import('/tmp/pf-build/hand-pose.mjs');
const tr = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter((e) => e.raw);
const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const raws = tr.map((e) => ({ t: e.t, pose: { position: e.raw.p, axis: e.raw.axis, dorsal: e.raw.dorsal, pxPerMm: e.raw.s, fingerAngleDeg: 0 } }));
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
function metrics(series) { // series: [{p:[x,y,z], q, s}]
  const pos2 = [], steps = [], rot = [], sc2 = [];
  for (let i = 1; i < series.length; i++) { steps.push(Math.hypot(series[i].p[0] - series[i - 1].p[0], series[i].p[1] - series[i - 1].p[1])); rot.push(qAngle(series[i].q, series[i - 1].q) * 180 / Math.PI); }
  for (let i = 1; i < series.length - 1; i++) { pos2.push(Math.hypot(series[i + 1].p[0] - 2 * series[i].p[0] + series[i - 1].p[0], series[i + 1].p[1] - 2 * series[i].p[1] + series[i - 1].p[1])); sc2.push((series[i + 1].s - 2 * series[i].s + series[i - 1].s) / series[i].s * 100); }
  // reference path: non-causal gaussian smoothing of RAW (sigma 5 frames)
  return { posJitterPx: +(rms(pos2) / Math.sqrt(6)).toFixed(2), posStepRms: +rms(steps).toFixed(2), rotStepRmsDeg: +rms(rot).toFixed(2), scaleJitterPct: +(rms(sc2) / Math.sqrt(6)).toFixed(3) };
}
const toS = (p) => ({ p: p.position, q: poseToQuat(p), s: p.pxPerMm });
const rawSeries = raws.map((r) => toS(r.pose));
const g = (arr, f) => arr.map((_, i) => { let w = 0, a = [0, 0, 0, 0]; for (let k = -12; k <= 12; k++) { const j = i + k; if (j < 0 || j >= arr.length) continue; const ww = Math.exp(-(k * k) / (2 * 25)); w += ww; const v = f(arr[j]); for (let c = 0; c < v.length; c++) a[c] += ww * v[c]; } return a.map((x) => x / w); });
const ref = g(rawSeries, (s) => [s.p[0], s.p[1], s.p[2], s.s]);
const trackErr = (series) => +rms(series.map((s, i) => Math.hypot(s.p[0] - ref[i][0], s.p[1] - ref[i][1]))).toFixed(2);
// legacy
let prev = null; const legacy = [];
for (const r of raws) { prev = smoothPose(prev, r.pose); legacy.push(toS(prev)); }
const f = new PoseFilter(opts); const next = [];
for (const r of raws) { const o = f.update(r.pose, r.t); if (o) next.push({ p: o.position, q: o.quat, s: o.pxPerMm }); }
const out = { frames: raws.length, durS: +((raws.at(-1).t - raws[0].t) / 1000).toFixed(1), opts, raw: { ...metrics(rawSeries), trackErrPx: trackErr(rawSeries) }, legacy_alpha045: { ...metrics(legacy), trackErrPx: trackErr(legacy) }, poseFilter: { ...metrics(next), trackErrPx: trackErr(next) } };
console.log(JSON.stringify(out));
