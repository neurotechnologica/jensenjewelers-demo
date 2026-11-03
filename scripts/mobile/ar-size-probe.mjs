// How much of the in-sheet 3D box does the ring fill? Opens ?ar=1 on a phone profile, waits for model-viewer to load, screenshots the
// viewer and reports the ring's bounding box as a fraction of the box + the model's real dimensions (mm). BASE, LABEL, PROFILE, OUT, PW_ROOT.
import fs from 'fs';
import { chromium, PROFILES, OUT, ARGS, mk } from './lib.mjs';
const BASE = process.env.BASE, LABEL = process.env.LABEL || 'run', PROF = process.env.PROFILE || 'iphone14';
const dir = `${OUT}${LABEL}/`; mk(dir);
const b = await chromium.launch({ args: ARGS });
const c = await b.newContext({ ...PROFILES[PROF], deviceScaleFactor: 2 });
const p = await c.newPage();
await p.goto(`${BASE}?ring=white-gold,sapphire&ar=1`, { waitUntil: 'commit' });
await p.waitForSelector('[data-testid=model-viewer]', { timeout: 120000 });
await p.waitForFunction(() => { const m = document.querySelector('model-viewer'); return m && m.loaded && m.modelIsVisible !== false; }, null, { timeout: 120000 });
await p.waitForTimeout(2500);
const dims = await p.evaluate(() => { const m = document.querySelector('model-viewer'); const d = m.getDimensions(); return { mm: [d.x, d.y, d.z].map((v) => +(v * 1000).toFixed(1)), orbit: m.getAttribute('camera-orbit'), fov: m.getAttribute('field-of-view'), arScale: m.getAttribute('ar-scale'), box: (() => { const r = m.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() }; });
const el = await p.$('[data-testid=model-viewer]');
await el.screenshot({ path: `${dir}ar-sheet-viewer-${PROF}.png` });
await p.screenshot({ path: `${dir}ar-sheet-${PROF}.png` });
fs.writeFileSync(`${dir}ar-size-${PROF}.json`, JSON.stringify(dims, null, 1));
console.log(JSON.stringify(dims));
await b.close();
