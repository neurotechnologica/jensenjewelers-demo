// P0.4 truthful copy. Run against the new build for assertions + "after" shots; E2E_BEFORE=1 (main build) only takes the "before" shots.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp, unlockAuditReport } from './helpers';

const EVID = process.env.E2E_EVIDENCE_DIR || 'e2e-results/evidence';
const BEFORE = process.env.E2E_BEFORE === '1';
const tag = BEFORE ? 'before' : 'after';
fs.mkdirSync(EVID, { recursive: true });
const shot = (page: Page, name: string, info: { project: { name: string } }, full = false) => page.screenshot({ path: path.join(EVID, `${tag}-${info.project.name}-${name}.png`), fullPage: full });

// Make the audit a South African store (ZAR) without touching the shipped content.json
async function asSouthAfrica(page: Page, currency = 'ZAR') {
  await page.route('**/content.json*', async (route) => {
    const res = await route.fetch(); const j = JSON.parse((await res.text()).replace(/^\uFEFF/, '')); // tolerate a UTF-8 BOM (Windows-written content.json)
    j.auditMeta = { ...(j.auditMeta || {}), currencyCode: currency, currencySymbol: currency === 'ZAR' ? 'R' : '$', locale: currency === 'ZAR' ? 'en-ZA' : 'en-US' };
    j.business = { ...(j.business || {}), name: 'Test & Co Jewellers' };
    j.liveDemo = { ...(j.liveDemo || {}), phoneCountryDefault: currency === 'ZAR' ? '+27' : '+1' };
    await route.fulfill({ response: res, contentType: 'application/json', body: JSON.stringify(j) });
  });
}
const visibleText = (page: Page) => page.evaluate(() => document.body.innerText);

test('checkout step 1 (ZAR store): honest headline, real-vs-not list, quote-in-ZAR', async ({ page }, info) => {
  await asSouthAfrica(page);
  await openApp(page, '#/checkout');
  await page.waitForTimeout(800);
  await shot(page, '01-checkout-configure', info);
  if (BEFORE) return;
  const t = await visibleText(page);
  expect(t).not.toMatch(/2 hours|hands-off|fully automatic|never lose another/i);
  expect(t).toMatch(/free audit, then done-for-you setup/i);
  expect(t).toMatch(/live within days/i);
  await expect(page.getByTestId('zar-note').first()).toHaveText(/Quote in ZAR/);
  await page.getByTestId('real-vs-not').locator('summary').click();
  await expect(page.getByTestId('real-vs-not')).toContainText('Self-serve sign-up');
  await expect(page.getByTestId('real-vs-not')).toContainText('Not available yet');
  await shot(page, '02-checkout-real-vs-not', info);
});

test('non-SA store keeps USD with no ZAR notes', async ({ page }) => {
  test.skip(BEFORE, 'after-only');
  await asSouthAfrica(page, 'USD'); // the shipped Test & Co content is itself a ZAR store, so force USD
  await openApp(page, '#/checkout');
  await page.waitForTimeout(800);
  await expect(page.getByTestId('zar-note')).toHaveCount(0);
});

test('invoice step + confirmation say what is true', async ({ page }, info) => {
  await asSouthAfrica(page);
  await openApp(page, '#/checkout');
  await page.getByRole('button', { name: /Forward/ }).click();
  // P0.1 (lead capture) made the details step validated: Forward only works once the required fields are filled
  await page.locator('#lead-store').fill('Test & Co Jewellers');
  await page.locator('#lead-name').fill('Zoe Tester');
  await page.locator('#lead-email').fill('zoe@testco.example');
  await page.getByRole('button', { name: /Forward/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '03-checkout-invoice', info);
  if (BEFORE) return;
  const t = await visibleText(page);
  expect(t).not.toMatch(/under 2 hours|VITE_WISE|Wise payment URL/i);
  await expect(page.getByTestId('zar-total')).toContainText(/ZAR/);
  expect(t).toMatch(/Most stores are live within days/i);
});

test('audit page CTAs no longer promise 2 hours', async ({ page }, info) => {
  await asSouthAfrica(page);
  await openApp(page, '#/audit');
  await unlockAuditReport(page);
  await page.waitForTimeout(400);
  await shot(page, '04-audit-hero', info);
  if (BEFORE) return;
  const t = await visibleText(page);
  expect(t).not.toMatch(/2 hours|syncing every call/i);
  await expect(page.getByRole('button', { name: 'Get live within days' }).first()).toBeVisible();
});

test('home page has no unsupported claims in visible text', async ({ page }, info) => {
  await openApp(page, '#/');
  await page.waitForTimeout(1200);
  await shot(page, '05-home', info);
  if (BEFORE) return;
  const t = await visibleText(page);
  expect(t).not.toMatch(/95%\+ Resolution|hands-off|fully automatic|Instant concierge demo/i);
});
