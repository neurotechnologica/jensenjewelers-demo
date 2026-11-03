// Scroll the whole homepage to the bottom on a phone profile and record WebGL context count / loss, drawing-buffer MB, JS heap, console
// errors, page crash. BASE, LABEL (before|after), PROFILE (iphone14|pixel), THROTTLE, OUT, PW_ROOT.
import fs from 'fs';
import { chromium, PROFILES, OUT, ARGS, GL_REGISTRY, GPU_MEM, mk, skipSplash, scrollerSel } from './lib.mjs';
const BASE = process.env.BASE, LABEL = process.env.LABEL || 'run', PROF = process.env.PROFILE || 'iphone14', THROTTLE = Number(process.env.THROTTLE || 1);
const dir = `${OUT}${LABEL}/`; mk(dir);
const b = await chromium.launch({ args: ARGS });
const c = await b.newContext({ ...PROFILES[PROF], deviceScaleFactor: Number(process.env.DSF || PROFILES[PROF].deviceScaleFactor) });
await c.addInitScript(GL_REGISTRY);
await c.addInitScript(GPU_MEM);
const p = await c.newPage();
const cdp = await c.newCDPSession(p);
await cdp.send('Performance.enable');
if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const logs = []; let crashed = false;
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message.slice(0, 200)));
p.on('crash', () => { crashed = true; });
const heap = async () => { const m = (await cdp.send('Performance.getMetrics')).metrics; const g = (n) => m.find((x) => x.name === n)?.value ?? 0; return { jsHeapMB: +(g('JSHeapUsedSize') / 1048576).toFixed(1), nodes: g('Nodes'), docs: g('Documents') }; };
await p.goto(BASE, { waitUntil: 'commit' });
await skipSplash(p);
await scrollerSel(p);
await p.waitForTimeout(2500);
const samples = [];
const snap = async (tag) => samples.push({ tag, scrollTop: await p.evaluate(() => Math.round(window.__sc.scrollTop)), ...(await p.evaluate(() => window.__glStats())), gpuLiveMB: await p.evaluate(() => +(window.__gpuMem.liveBytes / 1048576).toFixed(1)), ...(await heap()) });
await snap('top');
const H = await p.evaluate(() => window.__sc.scrollHeight - window.__sc.clientHeight);
// fast, human-like fling to the bottom in ~14 steps, then dwell at the bottom (footer WebGL surface) and bounce up/down once
const steps = 14;
for (let i = 1; i <= steps; i++) {
  await p.evaluate((y) => window.__sc.scrollTo({ top: y }), Math.round((H * i) / steps));
  await p.waitForTimeout(220);
  if (i % 4 === 0) await snap(`down-${i}`);
}
await p.waitForTimeout(2500); await snap('bottom');
await p.screenshot({ path: `${dir}bottom-${PROF}.png` });
for (let k = 0; k < 2; k++) { await p.evaluate((y) => window.__sc.scrollTo({ top: y }), 0); await p.waitForTimeout(500); await p.evaluate((y) => window.__sc.scrollTo({ top: y }), H); await p.waitForTimeout(700); }
await p.waitForTimeout(1500); await snap('bottom-after-bounce');
const alive = await p.evaluate(() => 1).catch(() => 0);
const gl = await p.evaluate(() => window.__glStats()).catch(() => null);
const out = { base: BASE, label: LABEL, profile: PROF, cpuThrottle: THROTTLE, pageHeightPx: H, crashed, pageAlive: !!alive, peakLiveContexts: Math.max(...samples.map((s) => s.liveConnected)), peakAliveContexts: Math.max(...samples.map((s) => s.aliveContexts)), peakBufferMB: Math.max(...samples.map((s) => s.bufferMB)), peakEstGpuTexRbMB: Math.max(...samples.map((s) => s.gpuLiveMB)), gpuBiggest: await p.evaluate(() => window.__gpuMem.biggest.slice(0, 12)), peakJsHeapMB: Math.max(...samples.map((s) => s.jsHeapMB)), contextsCreated: gl?.created, contextLost: gl?.lost, contextRestored: gl?.restored, finalCanvases: gl?.canvases, consoleErrorsAndWarnings: [...new Set(logs)].slice(0, 15), samples };
fs.writeFileSync(`${dir}crash-probe-${PROF}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, samples: samples.map((s) => `${s.tag}:ctx=${s.liveConnected}/${s.aliveContexts},mb=${s.bufferMB},gpu=${s.gpuLiveMB},heap=${s.jsHeapMB}`) }, null, 1));
await b.close();
