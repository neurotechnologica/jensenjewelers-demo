// Fake-camera try-on: plays a recorded/synthetic hand video through Chromium's fake capture device, records the ring pose the overlay
// uses on every detected frame (via the e2e read-only hook, VITE_E2E_HOOKS=1 builds only), and reports jitter + orientation.
// Env: BASE, LABEL, VIDEO (mjpeg/y4m path), SECS, OUT, PW_ROOT, CHROME_ARGS, PROFILE
import fs from 'fs';
import { chromium, PROFILES, OUT, ARGS, mk } from './lib.mjs';
const BASE = process.env.BASE, LABEL = process.env.LABEL || 'run', VIDEO = process.env.VIDEO, SECS = Number(process.env.SECS || 24), PROF = process.env.PROFILE || 'iphone14';
const dir = `${OUT}${LABEL}/`; mk(dir);
const b = await chromium.launch({ args: [...ARGS, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${VIDEO}`] });
const c = await b.newContext({ ...PROFILES[PROF], deviceScaleFactor: 2, permissions: ['camera'] });
// trace every hook write (works for the old build too: pose = what the overlay drew)
await c.addInitScript(() => {
  const trace = (window.__tr = []);
  let cur;
  Object.defineProperty(window, '__ringTryOn', { configurable: true, get: () => cur, set: (v) => { cur = v; if (v && v.pose) trace.push({ t: performance.now(), label: v.handedness, p: v.pose.position, axis: v.pose.axis, dorsal: v.pose.dorsal, s: v.pose.pxPerMm, held: !!v.pose.held, raw: v.raw ? { p: v.raw.position, axis: v.raw.axis, dorsal: v.raw.dorsal, s: v.raw.pxPerMm } : null, hand: !!v.landmarks }); } });
});
const p = await c.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
await p.goto(`${BASE}?ring=yellow-gold,sapphire&tryon=1`, { waitUntil: 'commit' });
await p.waitForSelector('[data-testid=tryon-start]', { timeout: 120000 });
await p.click('[data-testid=tryon-start]');
await p.waitForFunction(() => document.querySelector('[data-testid=tryon-stage]')?.dataset.hand === 'detected', null, { timeout: 240000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${dir}tryon-live-${PROF}-1.png` });
const stage = await p.$('[data-testid=tryon-stage]');
await stage.screenshot({ path: `${dir}tryon-stage-${PROF}-1.png` });
await p.waitForTimeout(SECS * 1000);
await stage.screenshot({ path: `${dir}tryon-stage-${PROF}-2.png` });
const tr = await p.evaluate(() => window.__tr);
const fps = await p.evaluate(() => document.querySelector('[data-testid=tryon-fps]')?.textContent);
fs.writeFileSync(`${dir}tryon-trace-${PROF}.json`, JSON.stringify(tr));
// ---- metrics -------------------------------------------------------------
const dot = (a, b2) => a[0] * b2[0] + a[1] * b2[1] + a[2] * b2[2];
const cross = (a, b2) => [a[1] * b2[2] - a[2] * b2[1], a[2] * b2[0] - a[0] * b2[2], a[0] * b2[1] - a[1] * b2[0]];
const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const R = (axis, dorsal) => { const z = nrm(axis); const y0 = nrm(dorsal); const x = nrm(cross(y0, z)); const y = nrm(cross(z, x)); return [x, y, z]; }; // rows
const angDeg = (A, B) => { let tr = 0; for (let i = 0; i < 3; i++) tr += dot(A[i], B[i]); return (Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180) / Math.PI; };
const rms = (a) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
// split into segments at jumps (video loop restart / reacquire)
const seg = []; let cur = [];
for (const e of tr) { if (!e.hand) continue; const last = cur.at(-1); if (last && (e.t - last.t > 700 || Math.hypot(e.p[0] - last.p[0], e.p[1] - last.p[1]) > 120)) { if (cur.length > 8) seg.push(cur); cur = []; } cur.push(e); }
if (cur.length > 8) seg.push(cur);
const metrics = (sel) => {
  const pos = [], pos2 = [], rot = [], rot2 = [], sc = [], sc2 = [];
  for (const s of seg) {
    const pts = s.map(sel).filter(Boolean);
    for (let i = 1; i < pts.length; i++) { pos.push(Math.hypot(pts[i].p[0] - pts[i - 1].p[0], pts[i].p[1] - pts[i - 1].p[1])); rot.push(angDeg(R(pts[i].axis, pts[i].dorsal), R(pts[i - 1].axis, pts[i - 1].dorsal))); sc.push(Math.abs(pts[i].s / pts[i - 1].s - 1) * 100); }
    for (let i = 1; i < pts.length - 1; i++) { // second difference = acceleration: slow real motion ~0, tremor large
      pos2.push(Math.hypot(pts[i + 1].p[0] - 2 * pts[i].p[0] + pts[i - 1].p[0], pts[i + 1].p[1] - 2 * pts[i].p[1] + pts[i - 1].p[1]));
      sc2.push((pts[i + 1].s - 2 * pts[i].s + pts[i - 1].s) / pts[i].s * 100);
    }
  }
  return { samples: pos.length, posStepRmsPx: +rms(pos).toFixed(2), posStepP95Px: +pct(pos, 0.95).toFixed(2), posJitterPx: +(rms(pos2) / Math.sqrt(6)).toFixed(2), rotStepRmsDeg: +rms(rot).toFixed(2), rotStepP95Deg: +pct(rot, 0.95).toFixed(2), scaleStepRmsPct: +rms(sc).toFixed(2), scaleJitterPct: +(rms(sc2) / Math.sqrt(6)).toFixed(2) };
};
const filtered = metrics((e) => ({ p: e.p, axis: e.axis, dorsal: e.dorsal, s: e.s }));
const rawM = tr.some((e) => e.raw) ? metrics((e) => (e.raw ? { p: e.raw.p, axis: e.raw.axis, dorsal: e.raw.dorsal, s: e.raw.s } : null)) : null;
// orientation: stone (ring +y == dorsal) vs the camera: for a back-of-hand view the stone must point TOWARD the camera (+z)
const dz = tr.filter((e) => e.hand).map((e) => e.dorsal[2]); const labels = {}; tr.forEach((e) => { labels[e.label] = (labels[e.label] || 0) + 1; });
const flips = (() => { let n = 0; let prev; for (const e of tr) { if (!e.hand) continue; const s = Math.sign(e.dorsal[2]); if (prev && s !== prev) n++; prev = s; } return n; })();
const out = { base: BASE, label: LABEL, profile: PROF, video: VIDEO.split(/[\\/]/).pop(), detectedFrames: tr.filter((e) => e.hand).length, hookWrites: tr.length, segments: seg.length, uiFps: fps, pageErrors: errs, dorsalZ: { mean: +(dz.reduce((a, v) => a + v, 0) / dz.length).toFixed(3), min: +Math.min(...dz).toFixed(3), max: +Math.max(...dz).toFixed(3), signFlips: flips }, handednessLabels: labels, filtered, raw: rawM };
fs.writeFileSync(`${dir}tryon-jitter-${PROF}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close();
