import { test, expect } from '@playwright/test';
import { axeSerious, openApp, watchConsole } from './helpers';

const lum = (r: number, g: number, b: number) => {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

test('hero: no console errors; mobile hero fade is present on phones and absent on desktop', async ({ page }) => {
  const errors = watchConsole(page);
  await openApp(page);
  const fade = page.getByTestId('hero-fade');
  const mobile = (page.viewportSize()!.width) < 768;
  if (mobile) {
    await expect(fade).toBeVisible();
    const bg = await fade.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toContain('linear-gradient');
  } else {
    await expect(fade).toBeHidden();
  }
  expect(errors.filter((e) => !/GPU stall|GL Driver|Failed to load resource/.test(e))).toEqual([]);
});

test('hero: legal text contrast >= 4.5:1 on rendered pixels (worst pixel and mean)', async ({ page }, info) => {
  test.skip((page.viewportSize()!.width) >= 768, 'the fade is a phone-only treatment');
  await openApp(page);
  const legal = page.getByText(/Optional\. By requesting a call/).first();
  // centre it: with the optional Turnstile widget (P0.2) the consent text starts under the floating nav, and scrollIntoViewIfNeeded does not move an element that is already inside the viewport
  await legal.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1500);
  const color = await legal.evaluate((el) => getComputedStyle(el).color);
  const [tr, tg, tb] = color.match(/\d+(\.\d+)?/g)!.map(Number);
  // render the background only: hide the glyphs, screenshot the text box, then measure every pixel
  await legal.evaluate((el) => { (el as HTMLElement).style.color = 'transparent'; });
  const buf = await legal.screenshot();
  await legal.evaluate((el) => { (el as HTMLElement).style.color = ''; });
  const px = await page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height); const g = c.getContext('2d')!; g.drawImage(bmp, 0, 0);
    return Array.from(g.getImageData(0, 0, bmp.width, bmp.height).data);
  }, buf.toString('base64'));
  const lt = lum(tr, tg, tb);
  let worst = Infinity, sum = 0, n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lb = lum(px[i], px[i + 1], px[i + 2]);
    const cr = (Math.max(lb, lt) + 0.05) / (Math.min(lb, lt) + 0.05);
    worst = Math.min(worst, cr); sum += cr; n++;
  }
  info.annotations.push({ type: 'contrast', description: `worst=${worst.toFixed(2)} mean=${(sum / n).toFixed(2)} text=${color}` });
  expect(worst).toBeGreaterThanOrEqual(4.5);
  expect(sum / n).toBeGreaterThanOrEqual(4.5);
});

test('ring builder: .fx-chip text meets 4.5:1 in the light theme (axe color-contrast)', async ({ page }) => {
  await openApp(page);
  const chip = page.locator('.fx-chip').first();
  await chip.scrollIntoViewIfNeeded().catch(() => {});
  if ((await page.locator('.fx-chip').count()) === 0) test.skip(true, 'no .fx-chip on the landing view');
  const v = await axeSerious(page, '.fx-chip', ['wcag2aa']);
  expect(v).toEqual([]);
});
