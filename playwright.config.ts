import { defineConfig } from '@playwright/test';

// E2E for the AR view, hand try-on, hero fade and splash. Builds with VITE_E2E_HOOKS=1 (read-only pose hook, never in a normal build) and
// serves the static build. Software GL (swiftshader) so it also runs on CI boxes / the farm PCs without a GPU.
// Fake camera: tests that need a live camera pass --use-file-for-fake-video-capture themselves.
const PORT = Number(process.env.E2E_PORT || 4199);
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 4197); // second build with VITE_ENABLE_ADMIN=1 (internal admin preview) for the admin-gate spec
const GL = (process.env.E2E_GL_ARGS || '--use-gl=swiftshader --enable-unsafe-swiftshader').split(' ').filter(Boolean); // e.g. '--use-angle=d3d11 --ignore-gpu-blocklist' on a machine with a GPU
const ARGS = [...GL, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'];
const LEAD_PORT = Number(process.env.E2E_LEAD_PORT || 4198); // e2e/lead-capture.spec.ts starts server/lead-api here; the build is pointed at it
const use = { launchOptions: { args: ARGS }, baseURL: `http://127.0.0.1:${PORT}` };

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'e2e-results/results.json' }]],
  outputDir: 'e2e-results/artifacts',
  webServer: [
    {
      command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: true,
      // VITE_CRO_SHORT=0: the legacy suites (splash, hero, ring, AR) test the long landing at "/"; short-audit.spec.ts opts in with ?v=short.
      // VITE_TRACK_URL points at a path on the preview server so the spec can intercept the tracker's beacons (nothing leaves the box).
      env: { VITE_E2E_HOOKS: "1", VITE_CRO_SHORT: "0", VITE_TRACK_URL: `http://127.0.0.1:${PORT}/__fc_events`, VITE_LEAD_ENDPOINT: `http://127.0.0.1:${LEAD_PORT}/api/lead`, VITE_DEMO_ENDPOINT: `http://127.0.0.1:${LEAD_PORT}/api/demo-call`, VITE_PAYMENTS_ENABLED: '1', VITE_CHECKOUT_ENDPOINT: `http://127.0.0.1:${LEAD_PORT}/api/checkout`, VITE_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' /* Cloudflare's public always-pass TEST key; the e2e stubs the script */ },
      timeout: 240_000,
    },
    {
      command: `npx vite build --outDir dist-e2e-admin && npx vite preview --outDir dist-e2e-admin --port ${ADMIN_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${ADMIN_PORT}/`,
      reuseExistingServer: true,
      env: { VITE_E2E_HOOKS: "1", VITE_ENABLE_ADMIN: "1" },
      timeout: 240_000,
    },
  ],
  projects: [
    { name: 'iphone14', use: { ...use, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' } },
    { name: 'pixel', use: { ...use, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36' } },
    { name: 'desktop-1366x768', use: { ...use, viewport: { width: 1366, height: 768 } } },
    { name: 'desktop-1280x800', use: { ...use, viewport: { width: 1280, height: 800 } } },
  ],
});
