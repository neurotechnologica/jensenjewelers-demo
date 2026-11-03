import { test, expect, type Page } from '@playwright/test';
import { openApp, watchConsole } from './helpers';

// Mobile ring builder / crash / splash regressions (TK 2026-10-02). Phone profiles only.
test.beforeEach(({}, info) => { test.skip(!['iphone14', 'pixel'].includes(info.project.name), 'phone profiles only'); });

const GL_REGISTRY = () => {
  const reg = ((window as any).__gl = { created: 0, lost: 0, restored: 0, canvases: new Set<HTMLCanvasElement>() });
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement & { __t?: boolean; __gl?: WebGLRenderingContext }, type: string, ...rest: unknown[]) {
    const ctx = (orig as any).call(this, type, ...rest);
    if (ctx && /webgl/.test(String(type)) && !this.__t) {
      this.__t = true; this.__gl = ctx; reg.created++; reg.canvases.add(this);
      this.addEventListener('webglcontextlost', () => reg.lost++);
      this.addEventListener('webglcontextrestored', () => reg.restored++);
    }
    return ctx;
  };
  (window as any).__glStats = () => ({ created: reg.created, lost: reg.lost, restored: reg.restored, alive: [...reg.canvases].filter((c: any) => { try { return !c.__gl.isContextLost(); } catch { return false; } }).length });
};

const scroller = (page: Page) => page.evaluate(() => {
  let s = document.querySelector('#ring-studio')!.parentElement as HTMLElement | null;
  while (s) { const oy = getComputedStyle(s).overflowY; if (oy === 'auto' || oy === 'scroll') break; s = s.parentElement; }
  (window as any).__sc = s; return !!s;
});
const hud = async (page: Page) => page.evaluate(() => {
  const w = document.querySelector('#ring-studio-interact') as HTMLElement; const h = document.querySelector('[data-testid=ring-hud]') as HTMLElement;
  const r = h.getBoundingClientRect(); const vh = window.innerHeight;
  return { on: w.dataset.hudOn, opacity: +getComputedStyle(w).opacity, pe: getComputedStyle(w).pointerEvents, inViewport: r.top >= 0 && r.bottom <= vh + 1 && r.height > 40, top: Math.round(r.top), bottom: Math.round(r.bottom), vh };
});

test('fast scroll to the ring section: HUD is visible even when the 3D scene never loads (poster shown, no layout jump)', async ({ page }) => {
  // the GLB hangs forever: the scene can never become ready
  await page.route('**/ring_webgi.glb', () => { /* never fulfilled */ });
  const errors = watchConsole(page);
  await openApp(page);
  expect(await scroller(page)).toBe(true);
  const stage = () => page.evaluate(() => { const s = document.querySelector('#ring-studio .sticky') as HTMLElement; const r = s.getBoundingClientRect(); return { h: Math.round(r.height), vh: window.innerHeight }; });
  // instant jumps: top of the section, then straight to the end of it (what a hard fling does), no waiting for anything
  await page.evaluate(() => { const sc = (window as any).__sc, el = document.querySelector('#ring-studio .relative') as HTMLElement; sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top; });
  const before = await stage();
  await page.evaluate(() => { const sc = (window as any).__sc, el = document.querySelector('[data-testid=ring-scroll-track]') as HTMLElement; const r = el.getBoundingClientRect(); sc.scrollTop += r.top - sc.getBoundingClientRect().top + (el.offsetHeight - sc.clientHeight); });
  await expect.poll(async () => (await hud(page)).on, { timeout: 5000 }).toBe('1');
  await expect.poll(async () => (await hud(page)).opacity, { timeout: 3000 }).toBe(1); // 500 ms fade-in
  const h = await hud(page);
  expect(h.pe).not.toBe('none');
  expect(h.inViewport, `HUD inside viewport (top ${h.top}, bottom ${h.bottom}, vh ${h.vh})`).toBe(true);
  // poster is the placeholder while the scene is not ready, and the sticky stage keeps the same size (no layout jump)
  await expect(page.getByTestId('ring-poster')).toHaveAttribute('data-ready', '0');
  const after = await stage();
  expect(after.h).toBe(before.h);
  expect(after.h).toBe(after.vh);
  expect(errors.filter((e) => !/GPU stall|GL Driver|Failed to load resource|ring_webgi/.test(e))).toEqual([]);
});

test('fast fling through the whole ring section: HUD turns on at the first frame past 50% progress (rAF-driven, not scene-driven)', async ({ page }) => {
  await openApp(page);
  await scroller(page);
  const res = await page.evaluate(async () => {
    const sc = (window as any).__sc as HTMLElement; const el = document.querySelector('[data-testid=ring-scroll-track]') as HTMLElement;
    const top0 = sc.scrollTop + el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    const range = el.offsetHeight - sc.clientHeight;
    sc.scrollTop = top0 - sc.clientHeight; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const w = document.querySelector('#ring-studio-interact') as HTMLElement;
    const seen: { p: number; on: string | undefined }[] = [];
    // 10 steps over ~160 ms (one frame each): crosses 0 -> 100 % of the section much faster than a 3D scene could load
    const total = sc.clientHeight + range + 40;
    for (let i = 1; i <= 10; i++) { sc.scrollTop = top0 - sc.clientHeight + (total * i) / 10; await new Promise((r) => requestAnimationFrame(r)); seen.push({ p: +(((sc.scrollTop - top0) / range)).toFixed(2), on: w.dataset.hudOn }); }
    await new Promise((r) => setTimeout(r, 300));
    return { seen, final: w.dataset.hudOn };
  });
  expect(res.final).toBe('1');
  expect(res.seen.some((s) => s.on === '1')).toBe(true);
});

test('bottom of the homepage on a phone: no crash, no context loss, at most 3 live WebGL contexts, no page errors', async ({ page }, info) => {
  await page.addInitScript(GL_REGISTRY);
  let crashed = false; page.on('crash', () => { crashed = true; });
  const errors = watchConsole(page);
  await openApp(page);
  await scroller(page);
  const H = await page.evaluate(() => (window as any).__sc.scrollHeight - (window as any).__sc.clientHeight);
  for (let i = 1; i <= 14; i++) { await page.evaluate((y) => (window as any).__sc.scrollTo({ top: y }), Math.round((H * i) / 14)); await page.waitForTimeout(160); }
  await page.waitForTimeout(2000);
  for (let k = 0; k < 2; k++) { await page.evaluate(() => (window as any).__sc.scrollTo({ top: 0 })); await page.waitForTimeout(300); await page.evaluate((y) => (window as any).__sc.scrollTo({ top: y }), H); await page.waitForTimeout(500); }
  const gl = await page.evaluate(() => (window as any).__glStats());
  await page.screenshot({ path: `e2e-results/bottom-${info.project.name}.png` });
  expect(crashed).toBe(false);
  expect(await page.evaluate(() => 1)).toBe(1);
  expect(gl.lost).toBe(0);
  expect(gl.alive, `live WebGL contexts: ${JSON.stringify(gl)}`).toBeLessThanOrEqual(3);
  expect(errors.filter((e) => !/GPU stall|GL Driver|Failed to load resource/.test(e))).toEqual([]);
});

test('only ONE Ring Builder instance is mounted on a phone (no hidden second WebGL scene)', async ({ page }) => {
  await openApp(page);
  expect(await page.locator('#ring-studio-hero [data-testid=ring-hud]').count()).toBe(0);
  expect(await page.locator('[data-testid=ring-hud]').count()).toBe(1);
  expect(await page.locator('canvas[id^=webgi-canvas]').count()).toBe(1);
});

test('GL context loss on the ring canvas: page survives, poster comes back, scene is rebuilt on restore', async ({ page }) => {
  await page.addInitScript(GL_REGISTRY);
  const errors = watchConsole(page);
  await openApp(page);
  await scroller(page);
  await page.evaluate(() => { const sc = (window as any).__sc, el = document.querySelector('[data-testid=ring-scroll-track]') as HTMLElement; sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top; });
  await expect(page.getByTestId('ring-poster')).toHaveAttribute('data-ready', '1', { timeout: 120_000 });
  const lost = await page.evaluate(() => { const c = document.querySelector('canvas[id^=webgi-canvas]') as HTMLCanvasElement; const gl = ((c as any).__gl || c.getContext('webgl2') || c.getContext('webgl')) as WebGL2RenderingContext; const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return false; ext.loseContext(); (window as any).__ext = ext; return true; });
  test.skip(!lost, 'WEBGL_lose_context not available');
  await expect(page.getByTestId('ring-poster')).toHaveAttribute('data-ready', '0', { timeout: 10_000 });
  expect(await page.evaluate(() => 1)).toBe(1);
  await page.evaluate(() => (window as any).__ext.restoreContext());
  await expect(page.getByTestId('ring-poster')).toHaveAttribute('data-ready', '1', { timeout: 120_000 });
  expect(errors.filter((e) => !/GPU stall|GL Driver|Failed to load resource|CONTEXT_LOST|context lost/i.test(e))).toEqual([]);
});

test('splash: the three-card trio is large on phones (>= 300 px wide stack, fits the screen) and has no WebGL canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('splash')).toBeVisible();
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid=splash] [class*="skew-y"]')] as HTMLElement[];
    const rs = cards.map((c) => c.getBoundingClientRect());
    const left = Math.min(...rs.map((r) => r.left)), right = Math.max(...rs.map((r) => r.right));
    return { n: cards.length, stackW: Math.round(right - left), left: Math.round(left), right: Math.round(right), vw: window.innerWidth, canvases: document.querySelectorAll('[data-testid=splash] canvas').length, cardH: Math.round(rs[0].height) };
  });
  expect(m.n).toBe(3);
  expect(m.stackW).toBeGreaterThanOrEqual(340);
  expect(m.left).toBeGreaterThanOrEqual(0);
  expect(m.right).toBeLessThanOrEqual(m.vw);
  expect(m.canvases).toBe(0);
});

test('AR sheet: ring fills the viewer box (not tiny), model is real size (~22 mm)', async ({ page }) => {
  await openApp(page, '?ring=white-gold,sapphire&ar=1');
  const mv = page.locator('model-viewer');
  await expect(mv).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => (document.querySelector('model-viewer') as any)?.loaded, null, { timeout: 120_000 });
  const d = await page.evaluate(() => { const m = document.querySelector('model-viewer') as any; const v = m.getDimensions(); return { mm: [v.x, v.y, v.z].map((x: number) => x * 1000), arScale: m.getAttribute('ar-scale'), fov: m.getAttribute('field-of-view'), orbit: m.getAttribute('camera-orbit') }; });
  expect(d.mm[0]).toBeGreaterThan(20); expect(d.mm[0]).toBeLessThan(24);
  expect(d.arScale).toBe('auto');
  expect(d.fov).toBe('30deg');
  expect(d.orbit).toContain('60mm');
});
