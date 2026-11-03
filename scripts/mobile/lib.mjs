// Shared helpers for the mobile probes (Playwright, Chromium). No secrets, no network beyond BASE.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const require = createRequire(path.join(process.env.PW_ROOT || process.cwd(), 'package.json'));
const pw = require('playwright');
export const devices = pw.devices;
// OVERRIDE_DIR: serve index.html + /assets/<hashed files> of BASE's origin from a local folder (a build that is NOT deployed), and let every
// other request (GLB, Draco, MediaPipe, AR assets, content.json ...) go to the real origin. Lets a farm PC test a PR build without deploying it.
const MIME = { js: 'text/javascript', css: 'text/css', html: 'text/html', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2' };
export async function applyOverride(context) {
  const dir = process.env.OVERRIDE_DIR; if (!dir) return;
  const origin = new URL(process.env.BASE).origin;
  await context.route((u) => u.origin === origin && (u.pathname === '/' || u.pathname === '/index.html' || u.pathname.startsWith('/assets/')), async (route) => {
    const u = new URL(route.request().url());
    const rel = u.pathname === '/' ? 'index.html' : u.pathname.slice(1);
    const f = path.join(dir, rel);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return route.fulfill({ status: 200, body: fs.readFileSync(f), contentType: MIME[f.split('.').pop()] || 'application/octet-stream', headers: { 'cache-control': 'no-store' } });
    return route.continue();
  });
}
export const chromium = { launch: async (o) => { const b = await pw.chromium.launch(o); const nc = b.newContext.bind(b); b.newContext = async (...a) => { const c = await nc(...a); await applyOverride(c); return c; }; return b; } };
export const OUT = (process.env.OUT || './mobile-probe-out/').replace(/([^\\/])$/, '$1/');
export const PROFILES = {
  iphone14: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 14'].userAgent },
  pixel: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
};
export const ARGS = (process.env.CHROME_ARGS || '--use-gl=swiftshader --enable-unsafe-swiftshader').split(' ').filter(Boolean);
export const mk = (d) => fs.mkdirSync(d, { recursive: true });

/** Init script: registry of every WebGL context the page creates + context-loss events. */
export const GL_REGISTRY = `(() => {
  const reg = (window.__gl = { created: 0, lost: 0, restored: 0, canvases: new Set(), events: [] });
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /webgl/.test(String(type)) && !this.__tracked) {
      this.__tracked = true; this.__gl = ctx; reg.created++; reg.canvases.add(this);
      this.addEventListener('webglcontextlost', () => { reg.lost++; reg.events.push(['lost', Math.round(performance.now())]); });
      this.addEventListener('webglcontextrestored', () => { reg.restored++; reg.events.push(['restored', Math.round(performance.now())]); });
    }
    return ctx;
  };
  window.__glStats = () => {
    const live = [...reg.canvases].filter((c) => c.isConnected);
    const mb = live.reduce((a, c) => a + (c.width * c.height * 4) / 1048576, 0);
    const alive = [...reg.canvases].filter((c) => { try { return !c.__gl.isContextLost(); } catch { return false; } });
    return { created: reg.created, liveConnected: live.length, aliveContexts: alive.length, lost: reg.lost, restored: reg.restored,
      bufferMB: +mb.toFixed(1), canvases: live.map((c) => ({ id: c.id || null, w: c.width, h: c.height, inView: (() => { const r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })() })) };
  };
})();`;


/** Init script part 2: estimate GPU allocations (textures + renderbuffers) so we can compare memory without a real device. */
export const GPU_MEM = `(() => {
  const BPP = { 0x8058: 4, 0x8051: 3, 0x8c43: 4, 0x8c41: 3, 0x881a: 8, 0x8814: 16, 0x881b: 6, 0x881f: 4, 0x822f: 4, 0x822d: 2, 0x822e: 4, 0x8229: 1, 0x822b: 2, 0x8230: 8, 0x8235: 4, 0x8d62: 2, 0x81a5: 2, 0x81a6: 3, 0x81a7: 4, 0x88f0: 4, 0x8cad: 5, 0x8056: 2, 0x8057: 2, 0x8d48: 1, 0x1908: 4, 0x1907: 3, 0x1906: 1, 0x1909: 1, 0x190a: 2, 0x8c3a: 4, 0x8059: 4, 0x8054: 6, 0x8815: 12 };
  const bpp = (f) => BPP[f] || 4;
  const st = (window.__gpuMem = { allocBytes: 0, liveBytes: 0, peakBytes: 0, biggest: [] });
  const sizes = new WeakMap(); const boundTex = new WeakMap(); const boundRb = new WeakMap();
  const set = (obj, bytes, what, w, h) => { if (!obj) return; const old = sizes.get(obj) || 0; sizes.set(obj, bytes); st.liveBytes += bytes - old; st.allocBytes += Math.max(0, bytes - old); st.peakBytes = Math.max(st.peakBytes, st.liveBytes); if (bytes > 2e6) st.biggest.push([what, w, h, Math.round(bytes / 1048576 * 10) / 10]); };
  for (const P of [window.WebGLRenderingContext && WebGLRenderingContext.prototype, window.WebGL2RenderingContext && WebGL2RenderingContext.prototype].filter(Boolean)) {
    const wrap = (name, fn) => { const o = P[name]; if (!o) return; P[name] = function (...a) { try { fn.call(this, a); } catch (e) {} return o.apply(this, a); }; };
    wrap('bindTexture', function (a) { let m = boundTex.get(this); if (!m) boundTex.set(this, (m = {})); m[a[0]] = a[1]; });
    wrap('bindRenderbuffer', function (a) { boundRb.set(this, a[1]); });
    wrap('texImage2D', function (a) { if (a[1] !== 0) return; const t = (boundTex.get(this) || {})[a[0]]; let w, h; if (typeof a[3] === 'number' && typeof a[4] === 'number' && a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[a.length - 1]; w = s && (s.width || s.videoWidth) || 0; h = s && (s.height || s.videoHeight) || 0; } set(t, w * h * bpp(a[2]), 'tex', w, h); });
    wrap('texStorage2D', function (a) { const t = (boundTex.get(this) || {})[a[0]]; set(t, a[3] * a[4] * bpp(a[2]) * (a[1] > 1 ? 1.34 : 1), 'texS', a[3], a[4]); });
    wrap('renderbufferStorage', function (a) { set(boundRb.get(this), a[2] * a[3] * bpp(a[1]), 'rb', a[2], a[3]); });
    wrap('renderbufferStorageMultisample', function (a) { set(boundRb.get(this), a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1]), 'rbMS' + a[1], a[3], a[4]); });
    wrap('deleteTexture', function (a) { if (a[0]) set(a[0], 0); });
    wrap('deleteRenderbuffer', function (a) { if (a[0]) set(a[0], 0); });
  }
})();`;

export async function skipSplash(p) {
  await p.waitForFunction(() => !document.querySelector('[data-testid="splash"]') && document.querySelector('#ring-studio, #ring-studio-hero'), null, { timeout: 120000 });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Got it')?.click());
}
export const scrollerSel = (p) => p.evaluate(() => {
  let s = document.querySelector('#ring-studio').parentElement;
  while (s) { const oy = getComputedStyle(s).overflowY; if (oy === 'auto' || oy === 'scroll') break; s = s.parentElement; }
  window.__sc = s || document.scrollingElement; return !!s;
});
