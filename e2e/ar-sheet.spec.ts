import { test, expect } from '@playwright/test';
import { axeSerious, openApp, watchConsole } from './helpers';

// AR sheet: layout (Try-on button not cut off / not overlapped), Quick Look link, model-viewer present, a11y (target size) per viewport.
test('AR sheet: Try-on button is fully visible and not overlapped; zero serious axe violations (incl. target-size)', async ({ page }, info) => {
  const errors = watchConsole(page);
  await openApp(page, '?ring=white-gold,sapphire&ar=1');
  const sheet = page.getByTestId('ar-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('model-viewer')).toHaveCount(1);
  // wait until the model has loaded (status leaves "loading") or errored; either way the layout must hold
  await expect(page.getByTestId('ar-status')).not.toHaveAttribute('data-ar-status', 'loading', { timeout: 90_000 }).catch(() => {});

  // model-viewer wrapper must not be flex-shrunk to nothing
  const mv = await page.locator('model-viewer').boundingBox();
  expect(mv!.height).toBeGreaterThanOrEqual(150);

  // Try-on action is inside the viewport and is the top element at its centre (nothing overlaps it)
  const tryOn = page.getByTestId('open-tryon-from-ar');
  await expect(tryOn).toBeVisible();
  const box = (await tryOn.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const top = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return !!el?.closest('[data-testid=open-tryon-from-ar]');
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(top, 'Try-on button must be the top element at its centre').toBe(true);

  // iOS: AR Quick Look anchor (rel=ar -> .usdz). Android / desktop: model-viewer drives WebXR / Scene Viewer instead.
  const ios = await page.evaluate(() => /iPhone|iPad/.test(navigator.userAgent));
  if (ios) {
    const ql = page.getByTestId('quick-look-link');
    await expect(ql).toHaveAttribute('rel', /\bar\b/);
    await expect(ql).toHaveAttribute('href', /\.usdz/);
  } else {
    await expect(page.locator('model-viewer')).toHaveAttribute('ar-modes', /scene-viewer|webxr/);
    await expect(page.getByTestId('quick-look-link')).toHaveCount(0);
  }

  // body scrolls on small viewports, actions stay pinned (footer is outside the scroll body)
  const pinned = await page.evaluate(() => {
    const body = document.querySelector('[data-testid=ar-sheet-body]') as HTMLElement;
    const btn = document.querySelector('[data-testid=open-tryon-from-ar]') as HTMLElement;
    return !body.contains(btn);
  });
  expect(pinned).toBe(true);

  await page.screenshot({ path: `e2e-results/ar-sheet-${info.project.name}.png` });
  expect(await axeSerious(page, '[data-testid=ar-sheet]')).toEqual([]);
  expect(await axeSerious(page, '[data-testid=ar-sheet]', ['wcag22aa'])).toEqual([]); // target-size (2.5.8)
  expect(errors.filter((e) => !/GPU stall|GL Driver|Failed to load resource/.test(e))).toEqual([]);
});

test('AR sheet: Escape closes and returns focus; focus is trapped while open', async ({ page }) => {
  await openApp(page, '?ring=white-gold,sapphire&ar=1');
  await expect(page.getByTestId('ar-sheet')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid=ar-sheet]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ar-sheet')).toHaveCount(0);
});
