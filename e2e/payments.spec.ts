// P0.6 test-mode payments: real browser -> real server/lead-api -> LOCAL MOCK of Stripe / Paystack (no provider is contacted, no money, test keys only).
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp } from './helpers';
import { startLeadStack, LEAD_PORT, APP_ORIGIN, type LeadStack } from './lead-server';
import { startMockProviders } from '../server/lead-api/dev/mock-providers.mjs';

const EVID = process.env.E2E_EVIDENCE_DIR || 'e2e-results/evidence';
fs.mkdirSync(EVID, { recursive: true });
const shot = (page: Page, name: string, info: { project: { name: string } }) => page.screenshot({ path: path.join(EVID, `${info.project.name}-${name}.png`) });
const timings: Record<string, number | string> = {};
const WHSEC = 'whsec_e2e', SK = 'sk_test_e2e';

let stack: LeadStack; let mock: Awaited<ReturnType<typeof startMockProviders>>;
test.beforeAll(async () => {
  mock = await startMockProviders({ webhookBase: `http://127.0.0.1:${LEAD_PORT}`, stripeWebhookSecret: WHSEC, paystackSecret: SK, stripeKey: SK, paystackKey: SK });
  stack = await startLeadStack({ PAYMENTS_ENABLED: '1', PAY_ZAR_PER_USD: '18.5', STRIPE_SECRET_KEY: SK, STRIPE_WEBHOOK_SECRET: WHSEC, PAYSTACK_SECRET_KEY: SK, STRIPE_API_BASE: mock.base, PAYSTACK_API_BASE: mock.base, PAY_RETURN_BASE_URL: `${APP_ORIGIN}/`, PAY_PER_IP_PER_HOUR: '100' });
});
test.afterAll(async ({}, info) => { await stack.stop(); await mock.close(); fs.writeFileSync(path.join(EVID, `${info.project.name}-payments-timings.json`), JSON.stringify(timings, null, 2)); });
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.removeItem('fourcee.leadQueue.v1')); });

async function requestInvoice(page: Page) {
  await openApp(page, '#/checkout');
  await page.locator('[data-testid=checkout-next]').click();
  await page.locator('#lead-store').fill('Test & Co Jewellers');
  await page.locator('#lead-name').fill('Zoe Tester');
  await page.locator('#lead-email').fill('zoe@testco.example');
  await page.locator('[data-testid=checkout-next]').click(); // -> step 3
  await page.locator('[data-testid=checkout-next]').click(); // request invoice
  await expect(page.locator('[data-testid=lead-ref]')).toBeVisible();
}
const lastLead = () => stack.leads().at(-1)!;

test('pay with card (Stripe test) end to end: server prices it, signed webhook marks the lead paid, banner confirms', async ({ page }, info) => {
  await requestInvoice(page);
  await expect(page.getByTestId('pay-online')).toContainText('Test mode');
  await shot(page, '01-request-sent-pay-options', info);
  const btn = page.getByTestId('pay-stripe-usd');
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44); // thumb-sized
  const t0 = Date.now();
  await btn.click();
  await page.waitForURL(`${mock.base}/pay/**`);
  timings['click_to_provider_page_ms'] = Date.now() - t0;
  await expect(page.getByTestId('mock-amount')).toHaveText('5997.00 USD'); // pro: $5,000 setup + $997 first month, chosen by the SERVER
  await shot(page, '02-mock-stripe-hosted-page', info);
  await page.getByTestId('mock-pay').click();
  await page.waitForURL(/pay=success/);
  await expect(page.getByTestId('pay-banner')).toContainText('Test payment received', { timeout: 60_000 });
  timings['click_to_paid_banner_ms'] = Date.now() - t0;
  await shot(page, '03-paid-banner', info);
  const l = lastLead();
  expect(l.paymentStatus).toBe('paid');
  expect(l.payment).toMatchObject({ mode: 'test', provider: 'stripe', amountMinor: 599700, currency: 'USD', status: 'paid' });
  const created = mock.calls.find((c: any) => c.kind === 'stripe-create');
  expect(created.headers.authorization).toBe(`Bearer ${SK}`);
  await expect.poll(() => stack.hooks.some((h) => h.body.includes('payment.received'))).toBe(true); // owner told
});

test('pay in rand (Paystack test): ZAR amount from the owner rate, webhook marks paid', async ({ page }, info) => {
  await requestInvoice(page);
  await page.getByTestId('pay-paystack-zar').click();
  await page.waitForURL(`${mock.base}/pay/**`);
  await expect(page.getByTestId('mock-amount')).toHaveText('110945.00 ZAR'); // 5,997 x 18.5 = R110 944.50 -> whole rand
  await shot(page, '04-mock-paystack-hosted-page', info);
  await page.getByTestId('mock-pay').click();
  await expect(page.getByTestId('pay-banner')).toContainText('Test payment received', { timeout: 60_000 });
  expect(lastLead()).toMatchObject({ paymentStatus: 'paid', payment: { provider: 'paystack', amountMinor: 11094500, currency: 'ZAR' } });
});

test('cancel at the provider: nothing charged, lead stays unpaid/pending, banner says so', async ({ page }, info) => {
  await requestInvoice(page);
  await page.getByTestId('pay-stripe-usd').click();
  await page.waitForURL(`${mock.base}/pay/**`);
  await page.getByTestId('mock-cancel').click();
  await expect(page.getByTestId('pay-banner')).toContainText('cancelled', { timeout: 60_000 });
  await shot(page, '05-cancelled-banner', info);
  expect(lastLead().paymentStatus).not.toBe('paid');
});

test('server down: the pay button shows a calm message and the lead is untouched', async ({ page }) => {
  await requestInvoice(page);
  await page.route('**/api/checkout', (r) => (r.request().method() === 'POST' ? r.abort('connectionrefused') : r.continue()));
  await page.getByTestId('pay-stripe-usd').click();
  await expect(page.getByTestId('pay-error')).toContainText('could not reach');
  expect(lastLead().paymentStatus).toBe('unpaid');
});

test('no secret or provider key is present in the shipped bundle', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  for (const a of assets) {
    const js = await (await request.get(a)).text();
    expect(js, a).not.toMatch(/sk_test_|sk_live_|whsec_|api\.stripe\.com|api\.paystack\.co/);
  }
});
