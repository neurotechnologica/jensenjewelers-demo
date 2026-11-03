import { test, expect, type Page } from '@playwright/test';
import { MEDIA, axeSerious, hasMedia, openApp, watchConsole } from './helpers';

const FAKE_CAM = [...(process.env.E2E_GL_ARGS || '--use-gl=swiftshader --enable-unsafe-swiftshader').split(' ').filter(Boolean), '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', ...(hasMedia('woman_hands.y4m') ? [`--use-file-for-fake-video-capture=${MEDIA}woman_hands.y4m`] : [])];
test.use({ launchOptions: { args: FAKE_CAM }, permissions: ['camera'] });
test.beforeEach(({}, info) => { test.skip(info.project.name === 'desktop-1280x800', 'covered by the other desktop size'); });

const spyGum = () => {
  (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks = [];
  const md = navigator.mediaDevices;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    const s = await orig(c);
    (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.push(...s.getTracks());
    return s;
  };
};
const tracks = (page: Page) => page.evaluate(() => (window as unknown as { __tracks: MediaStreamTrack[] }).__tracks.map((t) => t.readyState));
const benign = (e: string) => /GPU stall|GL Driver|Failed to load resource/.test(e);

test('try-on: closing while the camera is starting leaves no console error and ends every track', async ({ page }) => {
  const errors = watchConsole(page);
  await page.addInitScript(spyGum);
  // Make the MediaPipe model slow so Close lands inside the start path.
  await page.route('**/hand_landmarker.task', async (r) => { await new Promise((x) => setTimeout(x, 4000)); await r.continue(); });
  await openApp(page, '?ring=white-gold,sapphire&tryon=1');
  await expect(page.getByTestId('tryon-sheet')).toBeVisible();
  await page.getByTestId('tryon-start').click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(7000);
  expect(await page.getByTestId('tryon-sheet').count()).toBe(0);
  expect((await tracks(page)).every((s) => s === 'ended'), 'all camera tracks must be ended after close').toBe(true);
  expect(errors.filter((e) => !benign(e)), 'no "Cannot set properties of null (setting srcObject)"').toEqual([]);
});

test('try-on: live camera detects the hand, Stop ends the tracks', async ({ page }) => {
  test.skip(!hasMedia('woman_hands.y4m'), 'set E2E_MEDIA to a folder with woman_hands.y4m');
  const errors = watchConsole(page);
  await page.addInitScript(spyGum);
  await openApp(page, '?ring=white-gold,sapphire&tryon=1');
  await page.getByTestId('tryon-start').click();
  await expect(page.getByTestId('tryon-stage')).toHaveAttribute('data-phase', 'live', { timeout: 120_000 });
  await expect(page.getByTestId('tryon-stage')).toHaveAttribute('data-hand', 'detected', { timeout: 120_000 });
  await page.getByRole('button', { name: /stop/i }).click();
  await page.waitForTimeout(1000);
  expect((await tracks(page)).every((s) => s === 'ended')).toBe(true);
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test('try-on: photo upload detects the hand; sheet has zero serious axe violations', async ({ page }, info) => {
  test.skip(!hasMedia('woman_hands.jpg'), 'set E2E_MEDIA to a folder with woman_hands.jpg');
  const errors = watchConsole(page);
  await openApp(page, '?ring=white-gold,sapphire&tryon=1');
  await page.getByTestId('tryon-file').setInputFiles(MEDIA + 'woman_hands.jpg');
  await expect(page.getByTestId('tryon-stage')).toHaveAttribute('data-phase', 'photo', { timeout: 120_000 });
  await expect(page.getByTestId('tryon-stage')).toHaveAttribute('data-hand', 'detected');
  await page.screenshot({ path: `e2e-results/tryon-photo-${info.project.name}.png` });
  expect(await axeSerious(page, '[data-testid=tryon-sheet]')).toEqual([]);
  expect(await axeSerious(page, '[data-testid=tryon-sheet]', ['wcag22aa'])).toEqual([]);
  expect(errors.filter((e) => !benign(e))).toEqual([]);
});

test('try-on: camera denied falls back to photo upload without throwing', async ({ page }) => {
  const errors = watchConsole(page);
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', 'NotAllowedError')); });
  await openApp(page, '?ring=white-gold,sapphire&tryon=1');
  await page.getByTestId('tryon-start').click();
  await expect(page.getByTestId('tryon-file')).toHaveCount(1);
  expect(errors.filter((e) => /PAGEERROR/.test(e))).toEqual([]);
});
