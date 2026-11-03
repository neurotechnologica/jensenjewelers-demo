import { assetUrl } from './asset-url';

const RING_URL = () => assetUrl('assets/3D/ring_webgi.glb');
const DRACO_FILES = () =>
  ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'].map((f) => assetUrl(`draco/gltf/${f}`));

let networkPromise: Promise<void> | null = null;
let runtimePromise: Promise<void> | null = null;
let runtimeReady = false;

/** Fetch (and fully read, so the HTTP cache entry completes) a same-origin asset. Never throws. */
function warmFetch(url: string): Promise<void> {
  return fetch(url, { credentials: 'same-origin', cache: 'force-cache' })
    .then((r) => (r.ok ? r.blob() : undefined))
    .then(() => undefined)
    .catch(() => undefined);
}

/**
 * Network half of the preload: GLB (~1 MB) + Draco decoder (~760 KB) into the HTTP cache. Costs almost no main-thread time, so it is
 * safe to run while the splash animates. (There is no separate env map: the studio lighting is built into the WebGi pipeline.)
 */
export function preloadRingNetwork(): Promise<void> {
  if (networkPromise) return networkPromise;
  if (typeof window === 'undefined') return Promise.resolve();
  networkPromise = Promise.all([RING_URL(), ...DRACO_FILES()].map(warmFetch)).then(() => undefined);
  return networkPromise;
}

/** CPU half: download + parse the 2 MB webgi runtime. Run when the main thread is idle (after the splash / on first interaction). */
export function preloadRingRuntime(): Promise<void> {
  if (runtimePromise) return runtimePromise;
  if (typeof window === 'undefined') return Promise.resolve();
  runtimePromise = import('webgi')
    .then(() => {
      runtimeReady = true;
    })
    .catch(() => undefined);
  return runtimePromise;
}

export const ringRuntimeReady = () => runtimeReady;

/** Everything (network + runtime). Idempotent. */
export function preloadRingAssets(): Promise<void> {
  return Promise.all([preloadRingNetwork(), preloadRingRuntime()]).then(() => undefined);
}

/**
 * Start WebGi on the first pointer or key, or on requestIdleCallback after LCP has already painted.
 * The idle path waits out a quiet stretch first: parsing the 2MB runtime is one long task, and a timeout
 * that fires during that stretch is what put ~600ms on the desktop main thread.
 * One shared gate: the hero section and the canvas both call this, and the second call must not wait
 * another 6.5s after the first has already opened.
 */
let lcpGateOpen = false;
const lcpGateWaiters: Array<() => void> = [];

function openLcpGate(immediate: boolean) {
  if (lcpGateOpen) return;
  lcpGateOpen = true;
  const pending = lcpGateWaiters.splice(0);
  pending.forEach((fn) => fn(immediate));
}

export function scheduleAfterLcpIdle(run: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let cancelled = false;
  let idleId = 0;
  const start = (immediate: boolean) => {
    if (cancelled) return;
    if (immediate) {
      run();
      return;
    }
    const ric = window.requestIdleCallback;
    if (ric) idleId = ric(() => { if (!cancelled) run(); });
    else run();
  };
  if (lcpGateOpen) {
    start(false);
    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback?.(idleId);
    };
  }

  let po: PerformanceObserver | undefined;
  let quietTimer = 0;
  let fallbackTimer = 0;
  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const release = () => {
    events.forEach((e) => window.removeEventListener(e, onInteract));
    po?.disconnect();
    window.clearTimeout(quietTimer);
    window.clearTimeout(fallbackTimer);
  };
  function onInteract() {
    if (cancelled) return;
    release();
    openLcpGate(true);
  }
  const armQuiet = () => {
    if (cancelled || lcpGateOpen || quietTimer) return;
    quietTimer = window.setTimeout(() => {
      if (cancelled || lcpGateOpen) return;
      release();
      const ric = window.requestIdleCallback;
      if (ric) ric(() => openLcpGate(false));
      else openLcpGate(false);
    }, 6500);
  };

  lcpGateWaiters.push(start);
  events.forEach((e) => window.addEventListener(e, onInteract, { once: true, passive: true }));
  try {
    po = new PerformanceObserver((list) => {
      if (!list.getEntries().length) return;
      po?.disconnect();
      po = undefined;
      armQuiet();
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    armQuiet();
  }
  fallbackTimer = window.setTimeout(armQuiet, 8000);
  return () => {
    cancelled = true;
    const i = lcpGateWaiters.indexOf(start);
    if (i >= 0) lcpGateWaiters.splice(i, 1);
    release();
    if (idleId) window.cancelIdleCallback?.(idleId);
  };
}

/**
 * WebGi + the GLB are multi-megabyte. Load them on the first pointer or key, not during first paint and not on an idle
 * timer (that timer was pulling the 2 MB runtime into the Lighthouse window and inflating TBT).
 */
export function schedulePreloadRing(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let done = false;
  const events = ['pointerdown', 'touchstart', 'keydown'] as const;
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    void preloadRingAssets();
  };
  events.forEach((e) => window.addEventListener(e, run, { once: true, passive: true }));
  function cleanup() {
    events.forEach((e) => window.removeEventListener(e, run));
  }
  return cleanup;
}
