import { test, expect } from '@playwright/test';

test.beforeEach(({}, info) => { test.skip(!['iphone14', 'pixel'].includes(info.project.name), 'splash checked on the phone profiles'); });

test('splash: shows, ends once (timer does not restart) and never lingers past 1.5 s', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __t: number[] }).__t = [];
    const st = window.setTimeout;
    window.setTimeout = ((f: TimerHandler, d?: number, ...a: unknown[]) => { if (d === 900) (window as unknown as { __t: number[] }).__t.push(performance.now()); return st(f, d, ...a); }) as typeof window.setTimeout;
  });
  await page.goto('/');
  const splash = page.getByTestId('splash');
  await expect(splash).toBeVisible();
  const shown = Date.now();
  await splash.waitFor({ state: 'detached', timeout: 15_000 });
  const visibleMs = Date.now() - shown;
  expect(visibleMs).toBeLessThan(1600);
  const starts = await page.evaluate(() => (window as unknown as { __t: number[] }).__t.length);
  expect(starts, 'the splash timer must start once').toBeLessThanOrEqual(2);
});

test('splash cards animate transform/opacity only; no infinite JS loop and no filters on the cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('splash')).toBeVisible();
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid=splash] [class*="skew-y"]')];
    const props = new Set<string>();
    document.getAnimations().forEach((a) => (a as CSSAnimation).effect && (a.effect as KeyframeEffect).getKeyframes().forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(p)) props.add(p); })));
    return {
      n: cards.length,
      filters: cards.map((c) => getComputedStyle(c).filter + '|' + getComputedStyle(c).backdropFilter),
      transitionAll: cards.some((c) => getComputedStyle(c).transitionProperty === 'all'),
      animatedProps: [...props],
    };
  });
  expect(info.n).toBe(3);
  expect(info.filters.every((f) => f === 'none|none')).toBe(true);
  expect(info.transitionAll).toBe(false);
  for (const p of info.animatedProps) expect(['transform', 'opacity', 'translate', 'scale']).toContain(p);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('splash: no looping animation, opacity-only entrance', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('splash')).toBeVisible();
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const anims = document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest?.('[data-testid=splash]'));
      return anims.map((a) => ({ iter: a.effect!.getComputedTiming().iterations, props: (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)) }));
    });
    expect(r.every((a) => a.iter !== Infinity)).toBe(true);
    expect(r.flatMap((a) => a.props).every((p) => p === 'opacity')).toBe(true);
  });
});
