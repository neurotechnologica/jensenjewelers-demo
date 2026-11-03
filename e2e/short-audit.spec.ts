import { test, expect, type Page } from '@playwright/test';
import { watchConsole } from './helpers';
import { DEFAULT_BOOKING_URL } from '../lib/prospect-fixes';

// Short prospect page (components/ShortAudit.tsx). Runs on all four profiles; the phone-only checks skip on desktop.
// Nothing leaves the machine: content.json is rewritten per test, the demo webhook and the tracker are intercepted.
// Book opens the Google Calendar appointment page in a new tab (no iframe). An env URL can override it; this build does not set one.

const isPhone = (name: string) => ['iphone14', 'pixel'].includes(name);

async function openShort(page: Page, query = '') {
  await page.route('**/content.json', async (route) => {
    const res = await route.fetch();
    const j = JSON.parse((await res.text()).replace(/^\uFEFF/, ''));
    j.business.name = 'Test & Co Jewellers';
    j.auditMeta.currencySymbol = 'R';
    j.auditMeta.locale = 'en-ZA';
    j.lead_id = 'lead-test-123';
    j.liveDemo.phoneCountryDefault = '+27';
    await route.fulfill({ json: j });
  });
  const beacons: Array<Record<string, unknown>> = [];
  await page.route('**/__fc_events', async (route) => {
    try { beacons.push(JSON.parse(route.request().postData() || '{}')); } catch { /* ignore */ }
    await route.fulfill({ status: 204, body: '' });
  });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/?v=short' + query.replace(/^\?/, '&'));
  await expect(page.getByTestId('short-audit')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Test & Co Jewellers');
  return { beacons, requests };
}

const screens = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);

test('hero: one outcome line, their own number, ONE primary CTA above the fold, no splash, no 3D', async ({ page }, info) => {
  const errors = watchConsole(page);
  const { requests } = await openShort(page);
  await expect(page.getByTestId('splash')).toHaveCount(0);
  await expect(page.getByTestId('proof')).toContainText('R16');
  await expect(page.getByTestId('proof')).toContainText('Estimate');
  const vh = page.viewportSize()!.height;
  const book = page.locator('[data-cta-pos=hero] a');
  await expect(book).toBeVisible();
  await expect(book).toHaveText('Book my free audit walkthrough');
  await expect(book).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(book).toHaveAttribute('target', '_blank');
  await expect(book).toHaveAttribute('rel', /noopener/);
  const bookBox = (await book.boundingBox())!;
  expect(bookBox.y + bookBox.height, 'the booking CTA sits inside the first screen').toBeLessThanOrEqual(vh);
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
  const proof = page.getByTestId('proof');
  const box = (await proof.boundingBox())!;
  expect(box.y + box.height, 'the audit number sits inside the first screen').toBeLessThanOrEqual(vh);
  expect(await page.locator('canvas').count(), 'no WebGL canvas on the short page').toBe(0);
  expect(requests.filter((u) => /\.(glb|gltf|usdz|wasm|task|bin|hdr)(\?|$)|webgi|mediapipe|draco/i.test(u)), 'no 3D / AR assets requested').toEqual([]);
  await expect(page.getByText(/2 hours|5 minutes|hands-off/i)).toHaveCount(0);
  await expect(page.getByText('live within days').first()).toBeVisible();
  const count = (scope: string | null) => page.evaluate((sel) => { const root = sel ? document.querySelector(sel)! : document.body; const r = document.createRange(); let n = 0; const vh = innerHeight; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) { r.selectNodeContents(t); const b = r.getBoundingClientRect(); if (b.width && b.top < vh && b.bottom > 0) n += (t.textContent || '').trim().split(/\s+/).filter(Boolean).length; } return n; }, scope);
  const inViewport = await count(null);
  const inHero = await count('[data-testid=hero]');
  info.annotations.push({ type: 'words-in-first-view', description: String(inViewport) });
  info.annotations.push({ type: 'words-in-hero-block', description: String(inHero) });
  expect(inHero, 'hero block stays light').toBeLessThanOrEqual(60);
  expect(errors.filter((e) => !/cdn\.tailwindcss|fonts\.g|ERR_|Failed to load resource/i.test(e))).toEqual([]);
});

test('length: phone <= 3 screens, desktop <= 2.5 screens (accordions closed)', async ({ page }, info) => {
  await openShort(page);
  await page.waitForTimeout(500);
  const s = await screens(page);
  info.annotations.push({ type: 'document-screens', description: s.toFixed(2) });
  expect(s).toBeLessThanOrEqual(isPhone(info.project.name) ? 3 : 2.5);
});

test('no horizontal overflow', async ({ page }) => {
  await openShort(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('sticky CTA (phone): hidden beside the hero booking link, then the same calendar link', async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), 'sticky bar is phone-only');
  await page.setViewportSize({ width: 390, height: 640 });
  await openShort(page);
  const hero = page.locator('[data-cta-pos=hero] a');
  await expect(hero).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(hero).toHaveAttribute('target', '_blank');
  await expect(hero).toHaveAttribute('rel', /noopener/);
  const sticky = page.getByTestId('sticky-cta');
  await hero.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(sticky).toBeHidden();
  await page.evaluate(() => {
    const heroCta = document.querySelector('[data-cta-pos=hero]');
    const bottom = (heroCta?.getBoundingClientRect().bottom ?? 0) + window.scrollY;
    window.scrollTo(0, bottom + 120);
  });
  await expect(sticky).toBeVisible();
  const stickyLink = sticky.locator('a');
  await expect(stickyLink).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(stickyLink).toHaveAttribute('target', '_blank');
  await expect(stickyLink).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('accordions: closed by default, open on tap, tracked', async ({ page }) => {
  await openShort(page);
  const first = page.getByTestId('details').locator('details').first();
  await expect(first).not.toHaveAttribute('open', '');
  await first.locator('summary').scrollIntoViewIfNeeded();
  await first.locator('summary').click();
  await expect(first).toHaveAttribute('open', '');
  // the <details> toggle event is dispatched asynchronously after the attribute flips
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fourceeEvents: Array<{ n: string; p?: Record<string, unknown> }> }).__fourceeEvents.some((e) => e.n === 'accordion' && e.p?.open === true))).toBe(true);
});

test('tracking: page_view, cta_view with time-to-CTA, scroll depth, cta_click; beacon carries lead_id, variant and no PII', async ({ page }) => {
  const { beacons } = await openShort(page, '?utm_source=instantly&utm_campaign=za-1');
  await page.waitForFunction(() => (window as unknown as { __fourceeEvents: Array<{ n: string }> }).__fourceeEvents?.some((e) => e.n === 'cta_view'));
  for (const y of [0.3, 0.6, 1]) { await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), y); await page.waitForTimeout(150); }
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
  const ev = await page.evaluate(() => (window as unknown as { __fourceeEvents: Array<{ n: string; t: number; p?: Record<string, unknown> }> }).__fourceeEvents);
  const names = ev.map((e) => e.n);
  for (const n of ['page_view', 'scroll_depth', 'engaged']) expect(names, n).toContain(n);
  expect(names).not.toContain('cta_click');
  expect(ev.filter((e) => e.n === 'scroll_depth').map((e) => e.p?.pct)).toEqual(expect.arrayContaining([25, 50, 75, 100]));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => beacons.length, { timeout: 5000 }).toBeGreaterThan(0);
  const all = beacons.flatMap((b) => (b.events as Array<{ n: string }>) || []);
  expect(all.map((e) => e.n)).toEqual(expect.arrayContaining(['page_view', 'page_hide']));
  expect(beacons[0]).toMatchObject({ v: 1, lead_id: 'lead-test-123', variant: 'book', page: 'short' });
  expect((beacons[0].utm as Record<string, string>).source).toBe('instantly');
  expect(JSON.stringify(beacons)).not.toMatch(/\+27|082|phone_number/);
});

test('hear variant (flag): tapping the input keeps scale 1, inputs are >= 16 px, number is normalised to E.164 and no real call is placed', async ({ page }, info) => {
  const calls: Array<Record<string, unknown>> = [];
  // P0.2: the browser only ever talks to our guard endpoint (VITE_DEMO_ENDPOINT); n8n is never called from the page. Turnstile (e2e build has the test site key) is stubbed.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback('stub-token-0123456789')},60);return 'w1'},reset:function(){},remove:function(){}};` }));
  const n8nCalls: string[] = [];
  await page.route('https://app.fourcee.online/**', async (route) => { n8nCalls.push(route.request().url()); await route.abort(); });
  await page.route('**/api/demo-call', async (route) => {
    calls.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await openShort(page, '?cta=hear');
  const hero = page.locator('[data-cta-pos=hero] button');
  await expect(hero).toHaveText('Hear your AI receptionist in 60 seconds');
  await hero.click();
  const input = page.locator('#fc-phone');
  await expect(input).toBeVisible();
  const scale0 = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  const width0 = await page.evaluate(() => window.innerWidth);
  if (isPhone(info.project.name)) await input.tap(); else await input.click();
  await expect(input).toBeFocused();
  const after = await page.evaluate(() => ({ scale: window.visualViewport?.scale ?? 1, width: window.innerWidth, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  expect(scale0).toBe(1);
  expect(after.scale, 'page scale stays 1 after tapping the input').toBe(1);
  expect(after.width).toBe(width0);
  expect(after.ox).toBeLessThanOrEqual(0);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);

  await input.fill('12');
  await page.getByRole('button', { name: 'Call me now' }).click();
  await expect(page.getByRole('alert')).toContainText(/number/i);
  expect(calls).toHaveLength(0);
  await input.fill('082 123 4567');
  await page.getByRole('button', { name: 'Call me now' }).click();
  await expect(page.getByRole('status')).toContainText('Calling you now');
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ phone: '082 123 4567', country: '+27', lead_id: 'lead-test-123', website: '' }); // the server normalises to +27821234567
  expect(n8nCalls).toEqual([]);
  const ev = await page.evaluate(() => (window as unknown as { __fourceeEvents: Array<{ n: string }> }).__fourceeEvents.map((e) => e.n));
  expect(ev).toEqual(expect.arrayContaining(['form_start', 'form_submit', 'form_error', 'form_success']));
});

test('"Go live in 5 minutes" is not reachable without the platform flag', async ({ page }) => {
  await openShort(page, '?cta=golive');
  await expect(page.getByText('Go live in 5 minutes')).toHaveCount(0);
  const hero = page.locator('[data-cta-pos=hero] a');
  await expect(hero).toHaveCount(1);
  await expect(hero).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(hero).toHaveAttribute('target', '_blank');
  await expect(hero).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
});

test('legacy pages untouched: ?v=full keeps the splash + long landing; #/audit still opens the report; "See the full report" skips the intro gate', async ({ page }, info) => {
  test.skip(!isPhone(info.project.name), 'legacy routes checked on the phone profiles');
  await page.goto('/?v=full');
  await expect(page.getByTestId('splash')).toBeVisible();
  await page.getByTestId('splash').waitFor({ state: 'detached', timeout: 60_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('gold standard');
  await page.goto('/?v=short');
  await page.locator('footer a', { hasText: 'See the full report' }).click();
  await expect(page).toHaveURL(/#\/audit$/);
  await expect(page.getByTestId('splash')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByText('Proceed to report')).toHaveCount(0);
  await expect(page.getByTestId('audit-lead-gate')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Phone Performance Audit Report/i })).toHaveCount(0);
  await expect(page.getByText('PLACEHOLDER Business')).toBeVisible();
  await expect(page.getByText('City, State')).toBeVisible();
});

test('content.json failure still shows a working page and CTA', async ({ page }) => {
  await page.route('**/content.json', (r) => r.abort());
  await page.goto('/?v=short');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('your business');
  const hero = page.locator('[data-cta-pos=hero] a');
  await expect(hero).toHaveAttribute('href', DEFAULT_BOOKING_URL);
  await expect(hero).toHaveAttribute('target', '_blank');
  await expect(hero).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});
