// P0.5 admin gate + sample data labelling. E2E_BEFORE=1 (main build) only takes the "before" shots.
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openApp } from './helpers';

const EVID = process.env.E2E_EVIDENCE_DIR || 'e2e-results/evidence';
const BEFORE = process.env.E2E_BEFORE === '1';
const tag = BEFORE ? 'before' : 'after';
const ADMIN_URL = `http://127.0.0.1:${process.env.E2E_ADMIN_PORT || 4197}`;
fs.mkdirSync(EVID, { recursive: true });
const shot = (page: Page, name: string, info: { project: { name: string } }, full = false) => page.screenshot({ path: path.join(EVID, `${tag}-${info.project.name}-${name}.png`), fullPage: full });

// The farm PCs / box run several agents' dev servers: make sure the server we talk to really serves THIS checkout's build output.
async function servedFromLocalDist(request: any, base: string, dir: string) {
  const html = await (await request.get(`${base}/`)).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1] as string);
  expect(assets.length).toBeGreaterThan(0);
  for (const a of assets) expect(fs.existsSync(path.join(dir, a)), `served ${a} is not in ${dir}: another server owns this port`).toBe(true);
  return assets;
}
const BASE = `http://127.0.0.1:${process.env.E2E_PORT || 4199}`;

test('default build: #/admin does not open the admin screen and has no hidden admin button', async ({ page }, info) => {
  await servedFromLocalDist(page.request, BASE, 'dist-e2e');
  await openApp(page, '#/admin');
  await page.waitForTimeout(800);
  await shot(page, '01-admin-route-default-build', info);
  // also switch to #/admin AFTER load (what a person typing the URL into an open tab does)
  await page.evaluate(() => { window.location.hash = '#/home'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.location.hash = '#/admin'; });
  await page.waitForTimeout(800);
  await shot(page, '01b-admin-hash-switched-after-load', info);
  const t = await page.evaluate(() => document.body.innerText);
  if (BEFORE) { console.log('BEFORE (main build) shows admin screen:', /Admin - Voice AI SaaS/i.test(t)); return; }
  expect(t).not.toMatch(/Admin - Voice AI SaaS|MRR|Add client/i);
  await expect(page.getByLabel('Hidden admin access')).toHaveCount(0);
});

test('default build: no admin chunk or mock client data is shipped', async ({ request }) => {
  test.skip(BEFORE, 'after-only');
  const assets = await servedFromLocalDist(request, BASE, 'dist-e2e');
  for (const a of assets) {
    const js = await (await request.get(a)).text();
    expect(js, a).not.toMatch(/Admin - Voice AI SaaS|Hidden admin access|PhoneTester/);
  }
  expect(fs.readdirSync('dist-e2e/assets').filter((f) => /AdminDashboard/i.test(f))).toEqual([]); // no admin chunk emitted
});

test('VITE_ENABLE_ADMIN=1 build: admin opens with the internal-preview banner', async ({ page }, info) => {
  test.skip(BEFORE, 'after-only');
  const adminAssets = await servedFromLocalDist(page.request, ADMIN_URL, 'dist-e2e-admin');
  expect(fs.readdirSync('dist-e2e-admin/assets').some((f) => /^AdminDashboard/.test(f))).toBe(true); // the flag really compiles it in
  expect(adminAssets.length).toBeGreaterThan(0);
  await page.goto(`${ADMIN_URL}/#/admin`);
  await page.locator('[data-testid=splash]').waitFor({ state: 'detached', timeout: 60_000 });
  await expect(page.getByTestId('admin-sample-banner')).toBeVisible();
  await expect(page.getByTestId('admin-sample-banner')).toContainText(/sample data only/i);
  await shot(page, '02-admin-enabled-with-banner', info);
});

test('#/ops falls back to the site home', async ({ page }, info) => {
  await openApp(page, '#/ops');
  await page.waitForTimeout(800);
  await shot(page, '03-ops-route', info);
  if (BEFORE) return;
  expect(page.url()).not.toMatch(/#\/ops/);
  await expect(page.getByTestId('ops-sample-banner')).toHaveCount(0);
  const t = await page.evaluate(() => document.body.innerText);
  expect(t).not.toMatch(/Recovered \(sample\)|Call log · sample|SAMPLE DATA/i);
});
