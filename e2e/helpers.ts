import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Collect console errors / page errors. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  return errors;
}

/** The splash is skippable and under 1.5 s; wait for it to unmount. */
export async function openApp(page: Page, query = '') {
  await page.goto('/' + query);
  // the app is a lazy chunk: #root stays empty until it loads, and waiting for a splash that is not mounted yet would return at once
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, undefined, { timeout: 60_000 });
  await page.locator('[data-testid=splash]').waitFor({ state: 'detached', timeout: 60_000 });
}

/** The audit report sits behind a name / email / phone gate and opens only after the lead API accepts the form. */
export async function unlockAuditReport(page: Page) {
  const gate = page.locator('#audit-lead-name');
  if (!(await gate.isVisible().catch(() => false))) return;
  await page.route('**/api/lead', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'e2e-lead' }) }));
  await gate.fill('Zoe Tester');
  await page.locator('#audit-lead-email').fill('zoe@testco.example');
  await page.locator('#audit-lead-phone').fill('0821234567');
  await page.getByRole('button', { name: /View my report/i }).click();
  await page.getByRole('heading', { name: /Phone Performance Audit Report/i }).waitFor({ state: 'visible', timeout: 30_000 });
}

export async function axeSerious(page: Page, include: string, tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']) {
  const r = await new AxeBuilder({ page }).include(include).withTags(tags).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) }));
}

import fs from 'node:fs';
import path from 'node:path';
/** Folder with woman_hands.jpg / woman_hands.y4m (a back-of-hand photo and the same as a Y4M for Chromium's fake camera). Not committed
 *  (third-party stock image): set E2E_MEDIA=/path/to/folder. Tests that need it are skipped when it is missing. */
export const MEDIA = (process.env.E2E_MEDIA || '').replace(/([^\\/])$/, '$1/');
export const hasMedia = (f: string) => !!MEDIA && fs.existsSync(path.join(MEDIA, f));
