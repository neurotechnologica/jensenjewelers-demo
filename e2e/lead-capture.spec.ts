// P0.1 lead capture: real browser -> real server/lead-api (mock SMTP + webhook). Evidence: screenshots + timings in E2E_EVIDENCE_DIR.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp } from './helpers';
import { startLeadStack, type LeadStack } from './lead-server';

const EVID = process.env.E2E_EVIDENCE_DIR || 'e2e-results/evidence';
fs.mkdirSync(EVID, { recursive: true });
const timings: Record<string, number | string> = {};
const shot = (page: Page, name: string, info: { project: { name: string } }) => page.screenshot({ path: path.join(EVID, `${info.project.name}-${name}.png`), fullPage: false });
const FAKE = { store: 'Test & Co Jewellers', name: 'Zoe Tester', email: 'zoe@testco.example', phone: '+27 82 123 4567', notes: 'Mon-Sat 9-5, call after 3pm' };

let stack: LeadStack;
test.beforeAll(async () => { stack = await startLeadStack(); });
test.afterAll(async ({}, info) => {
  await stack.stop();
  fs.writeFileSync(path.join(EVID, `${info.project.name}-timings.json`), JSON.stringify(timings, null, 2));
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('fourcee.leadQueue.v1'));
});

async function toDetails(page: Page) {
  await openApp(page, '#/checkout');
  await page.locator('[data-testid=checkout-next]').click(); // Configure -> Details
  await expect(page.locator('#lead-name')).toBeVisible();
}
async function fillDetails(page: Page) {
  await page.locator('#lead-store').fill(FAKE.store);
  await page.locator('#lead-name').fill(FAKE.name);
  await page.locator('#lead-email').fill(FAKE.email);
  await page.locator('#lead-phone').fill(FAKE.phone);
  await page.locator('#lead-crm').selectOption('HubSpot');
  await page.locator('#lead-notes').fill(FAKE.notes);
}

test('blank details cannot be submitted: inline errors, focus, zero network requests', async ({ page }, info) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
  await toDetails(page);
  await page.locator('#lead-store').fill('');
  await page.locator('[data-testid=checkout-next]').click();
  await expect(page.locator('#lead-name-err')).toBeVisible();
  await expect(page.locator('#lead-email-err')).toBeVisible();
  await expect(page.locator('#lead-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#lead-store')).toBeFocused(); // first invalid field
  await page.locator('#lead-store').fill(FAKE.store);
  await page.locator('#lead-name').fill(FAKE.name);
  await page.locator('#lead-email').fill('not-an-email');
  await page.locator('[data-testid=checkout-next]').click();
  await expect(page.locator('#lead-email-err')).toContainText('valid email');
  await shot(page, '01-validation', info);
  expect(posts).toEqual([]);
  expect(stack.leads()).toHaveLength(0);
});

test('happy path: Request invoice POSTs every field, server stores it, owner gets email + webhook, success shows reference', async ({ page }, info) => {
  const before = stack.leads().length, mails = stack.mail.messages.length, hooks = stack.hooks.length;
  const reqs: { url: string; body: any }[] = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/lead')) reqs.push({ url: r.url(), body: JSON.parse(r.postData() || '{}') }); });
  await toDetails(page);
  await fillDetails(page);
  await shot(page, '02-details-filled', info);
  await page.locator('[data-testid=checkout-next]').click(); // -> invoice step
  await expect(page.getByText('Order summary')).toBeVisible();
  const t0 = Date.now();
  await page.locator('[data-testid=checkout-next]').click(); // Request invoice
  await expect(page.locator('[data-testid=lead-ref]')).toBeVisible();
  timings[`${info.project.name}: click Request invoice -> success shown (ms)`] = Date.now() - t0;
  await shot(page, '03-success', info);
  expect(reqs).toHaveLength(1);
  expect(reqs[0].url).toMatch(/\/api\/lead$/);
  expect(reqs[0].body).toMatchObject({ name: FAKE.name, email: FAKE.email, phone: FAKE.phone, store: FAKE.store, plan: 'pro', notes: FAKE.notes, crm: 'HubSpot', billing_cycle: 'monthly', website: '' });
  expect(reqs[0].body.idempotency_key).toBeTruthy();
  await expect.poll(() => stack.leads().length).toBe(before + 1);
  const lead = stack.leads().at(-1)!;
  expect(lead).toMatchObject({ name: FAKE.name, email: FAKE.email, phone: FAKE.phone, store: FAKE.store, plan: 'pro', notes: FAKE.notes, paymentStatus: 'unpaid' });
  await expect.poll(() => stack.mail.messages.length).toBe(mails + 1);
  await expect.poll(() => stack.hooks.length).toBe(hooks + 1);
  const mail = stack.mail.decode(stack.mail.messages.at(-1)!);
  expect(mail.subject).toContain('Test & Co Jewellers'); expect(mail.text).toContain(FAKE.email);
  expect(await page.evaluate(() => localStorage.getItem('fourcee.leadQueue.v1'))).toMatch(/^(\[\])?$|null/);
  timings[`${info.project.name}: lead stored + email + webhook confirmed`] = 'ok';
});

test('server down: clear error, lead kept in localStorage, Retry delivers it exactly once', async ({ page }, info) => {
  const before = stack.leads().length;
  let block = true;
  await page.route('**/api/lead', (route) => (block ? route.abort('connectionrefused') : route.fallback()));
  await toDetails(page); await fillDetails(page);
  await page.locator('[data-testid=checkout-next]').click();
  await page.locator('[data-testid=checkout-next]').click();
  await expect(page.locator('[data-testid=lead-error]')).toBeVisible();
  await expect(page.locator('[data-testid=lead-error]')).toContainText('saved on this device');
  await expect(page.locator('[data-testid=lead-ref]')).toHaveCount(0);
  const queued = JSON.parse((await page.evaluate(() => localStorage.getItem('fourcee.leadQueue.v1'))) || '[]');
  expect(queued).toHaveLength(1); expect(queued[0]).toMatchObject({ email: FAKE.email, store: FAKE.store });
  await shot(page, '04-error-retry', info);
  expect(stack.leads().length).toBe(before);
  block = false;
  const t0 = Date.now();
  await page.locator('[data-testid=lead-retry]').click();
  await expect(page.locator('[data-testid=lead-ref]')).toBeVisible();
  timings[`${info.project.name}: Retry click -> success (ms)`] = Date.now() - t0;
  await expect.poll(() => stack.leads().length).toBe(before + 1);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('fourcee.leadQueue.v1'))) || '[]')).toHaveLength(0);
  await shot(page, '05-retry-success', info);
});

test('queued lead is re-sent automatically on the next visit (no duplicate if it was already delivered)', async ({ page }) => {
  const before = stack.leads().length;
  const lead = { name: 'Queued Quinn', email: 'quinn@testco.example', phone: '', store: 'Test & Co Jewellers', plan: 'starter', billing_cycle: 'monthly', notes: 'from queue', crm: '', total: 2997, currency: 'USD', website: '', idempotency_key: 'queue-key-0001', page_url: 'http://x/' };
  await page.addInitScript((l) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('fourcee.leadQueue.v1', JSON.stringify([l])); } }, lead);
  await page.goto('/#/checkout');
  await expect.poll(() => stack.leads().length, { timeout: 20_000 }).toBe(before + 1);
  expect(stack.leads().at(-1)).toMatchObject({ email: 'quinn@testco.example', notes: 'from queue' });
  await expect.poll(async () => JSON.parse((await page.evaluate(() => localStorage.getItem('fourcee.leadQueue.v1'))) || '[]').length).toBe(0);
  await page.reload();
  await page.waitForTimeout(1500);
  expect(stack.leads().length).toBe(before + 1);
});

test('honeypot filled by a bot: server drops it', async ({ page }) => {
  const before = stack.leads().length;
  await toDetails(page); await fillDetails(page);
  await page.locator('#lead-website').evaluate((el: HTMLInputElement) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; set.call(el, 'http://spam.example'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-testid=checkout-next]').click();
  await page.locator('[data-testid=checkout-next]').click();
  await expect(page.locator('[data-testid=lead-ref]')).toBeVisible();
  await page.waitForTimeout(500);
  expect(stack.leads().length).toBe(before);
});

// ---- mobile input size / zoom ------------------------------------------------------------------------------------------------------
test.describe('mobile input font-size (iOS focus zoom)', () => {
  test.beforeEach(({}, info) => { test.skip(!['iphone14', 'pixel'].includes(info.project.name), 'phone profiles only'); });

  test('viewport meta keeps pinch-zoom enabled', async ({ page }) => {
    await page.goto('/');
    const meta = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(meta).not.toMatch(/maximum-scale|user-scalable|minimum-scale/);
  });

  test('every text input/textarea/select is >= 16px and tapping it leaves visualViewport.scale at 1', async ({ page }, info) => {
    const report: Record<string, unknown>[] = [];
    const routes: [string, (p: Page) => Promise<void>][] = [
      ['#/checkout (details step)', async (p) => { await p.locator('[data-testid=checkout-next]').click(); await expect(p.locator('#lead-name')).toBeVisible(); }],
      ['#/audit (demo-call phone)', async () => {}],
      ['#/ops (portal tabs)', async (p) => { await p.getByRole('button', { name: 'onboard', exact: false }).first().click().catch(() => {}); }],
      ['#/admin', async () => {}],
      ['#/ (home)', async () => {}],
    ];
    for (const [label, prep] of routes) {
      await openApp(page, label.split(' ')[0]);
      await prep(page);
      await page.waitForTimeout(400);
      const controls = page.locator('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]), textarea, select');
      const n = await controls.count();
      for (let i = 0; i < n; i++) {
        const el = controls.nth(i);
        if (!(await el.isVisible())) continue;
        const box = await el.boundingBox();
        if (!box || box.width < 4 || box.x < -5) continue; // off-screen honeypot
        const fs16 = await el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.tap({ timeout: 4000, force: true }).catch(async () => { await el.focus(); });
        const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
        const id = await el.evaluate((e) => `${e.tagName.toLowerCase()}${(e as HTMLInputElement).type ? '[' + (e as HTMLInputElement).type + ']' : ''}#${e.id || (e as HTMLInputElement).name || (e as HTMLInputElement).placeholder || ''}`);
        report.push({ route: label, control: id, fontSizePx: fs16, scaleAfterTap: scale });
        expect.soft(fs16, `${label} ${id} font-size`).toBeGreaterThanOrEqual(16);
        expect.soft(scale, `${label} ${id} scale after tap`).toBe(1);
        await page.keyboard.press('Escape').catch(() => {});
      }
      if (label.startsWith('#/checkout')) await shot(page, '06-mobile-inputs-checkout', info);
    }
    fs.writeFileSync(path.join(EVID, `${info.project.name}-input-font-scale.json`), JSON.stringify(report, null, 2));
    expect(report.length).toBeGreaterThan(5);
  });
});
