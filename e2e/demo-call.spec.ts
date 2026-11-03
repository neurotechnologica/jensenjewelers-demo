// P0.3 demo webhook lockdown: real browser -> real guard (server/lead-api /api/demo-call) -> FAKE n8n. The real n8n webhook is never contacted.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, unlockAuditReport } from './helpers';
import { startLeadStack, type LeadStack } from './lead-server';

const EVID = process.env.E2E_EVIDENCE_DIR || 'e2e-results/evidence';
fs.mkdirSync(EVID, { recursive: true });
const timings: Record<string, number | string> = {};
const shot = (page: Page, name: string, info: { project: { name: string } }) => page.screenshot({ path: path.join(EVID, `${info.project.name}-${name}.png`) });
let stack: LeadStack;

test.beforeAll(async () => { stack = await startLeadStack(); });
test.afterAll(async ({}, info) => { await stack.stop(); fs.writeFileSync(path.join(EVID, `${info.project.name}-demo-timings.json`), JSON.stringify(timings, null, 2)); });
test.beforeEach(async ({ page }) => {
  // Turnstile stub: the real script is never loaded from Cloudflare in tests.
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.turnstile={render:function(el,o){setTimeout(function(){o.callback('stub-token-0123456789')},60);return 'w1'},reset:function(){},remove:function(){}};` }));
  stack.api.ctx.cfg.demo.enabled = true; stack.api.ctx.cfg.demo.turnstileSecret = '';
});

async function openPhone(page: Page) {
  await openApp(page, '#/audit');
  await unlockAuditReport(page);
  const input = page.getByLabel('Phone number').first();
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeVisible();
  return input;
}
const callBtn = (page: Page) => page.getByRole('button', { name: /^Call$|Calling/ }).first();

test('SA number typed with a leading 0 reaches n8n as +27…, via our guard only (browser never calls n8n)', async ({ page }, info) => {
  const hosts: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST') hosts.push(new URL(r.url()).host + new URL(r.url()).pathname); });
  const input = await openPhone(page);
  await page.getByRole('button', { name: 'Country code' }).first().click();
  await page.getByRole('option', { name: /ZA/ }).click();
  await input.fill('082 123 4567');
  await expect(callBtn(page)).toBeEnabled(); // waits for the Turnstile stub token
  await shot(page, 'd1-before-call', info);
  const t0 = Date.now(); const n = stack.n8n.length;
  await callBtn(page).click();
  await expect(page.getByText('Call initiated')).toBeVisible();
  timings[`${info.project.name}: click Call -> "Call initiated" (ms)`] = Date.now() - t0;
  await shot(page, 'd2-call-initiated', info);
  await expect.poll(() => stack.n8n.length).toBe(n + 1);
  const f = stack.n8n.at(-1)!;
  expect(f.body.phone_number).toBe('+27821234567'); expect(f.body.phone_number).not.toMatch(/^\+270/);
  expect(f.headers['x-fourcee-secret']).toBe('e2e-secret');
  const posts = hosts.filter((h) => h.includes('demo-call') || h.includes('webhook'));
  expect(posts).toEqual([`127.0.0.1:${process.env.E2E_LEAD_PORT || 4198}/api/demo-call`]);
  expect(hosts.some((h) => h.includes('fourcee.online'))).toBe(false);
});

test('invalid number: inline message, no request at all', async ({ page }, info) => {
  const posts: string[] = []; page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
  const input = await openPhone(page);
  await page.getByRole('button', { name: 'Country code' }).first().click();
  await page.getByRole('option', { name: /ZA/ }).click();
  await input.fill('0861234567'); // premium/shared-cost range
  await expect(callBtn(page)).toBeEnabled();
  await callBtn(page).click();
  await expect(page.getByTestId('demo-error')).toContainText(/cannot be called/i);
  await shot(page, 'd3-invalid-number', info);
  await input.fill('12345'); await callBtn(page).click();
  await expect(page.getByTestId('demo-error')).toContainText(/9 digits/);
  expect(posts.filter((u) => u.includes('demo-call'))).toEqual([]);
});

test('kill switch: server paused -> friendly message, no call forwarded, no alert() dialog', async ({ page }, info) => {
  let dialog = false; page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  const input = await openPhone(page);
  await page.getByRole('button', { name: 'Country code' }).first().click();
  await page.getByRole('option', { name: /ZA/ }).click();
  await input.fill('0821110001');
  stack.api.ctx.cfg.demo.enabled = false;
  const n = stack.n8n.length;
  await expect(callBtn(page)).toBeEnabled();
  await callBtn(page).click();
  await expect(page.getByTestId('demo-error')).toContainText(/paused/i);
  await shot(page, 'd4-paused', info);
  expect(stack.n8n.length).toBe(n); expect(dialog).toBe(false);
});

test('Turnstile required server-side: the widget token is sent and verified by the server', async ({ page }) => {
  stack.api.ctx.cfg.demo.turnstileSecret = 'e2e-ts-secret';
  const input = await openPhone(page);
  await page.getByRole('button', { name: 'Country code' }).first().click();
  await page.getByRole('option', { name: /ZA/ }).click();
  await input.fill('0821110002');
  await expect(callBtn(page)).toBeEnabled();
  const n = stack.n8n.length, v = stack.tsSeen.length;
  await callBtn(page).click();
  await expect(page.getByText('Call initiated')).toBeVisible();
  expect(stack.n8n.length).toBe(n + 1);
  expect(stack.tsSeen.length).toBe(v + 1);
  expect(stack.tsSeen.at(-1)).toContain('response=stub-token-0123456789');
});

test('built bundle contains no n8n webhook URL', async () => {
  const dir = path.join('dist-e2e', 'assets');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    expect(src, f).not.toContain('voice-demo-request');
    expect(src, f).not.toContain('app.fourcee.online');
  }
});
