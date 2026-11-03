import type { RingSwatch } from '../types/audit';

/**
 * AR-ready exports of the EXISTING ring (public/assets/3D/ring_webgi.glb) — no new design.
 * One file per metal because Android Scene Viewer / iOS Quick Look cannot recolour a model at runtime.
 * Regenerate with scripts/ar/build-ar-assets.sh (see docs/AR-TRYON.md).
 */
export type ArMetalKey = 'yellow-gold' | 'white-gold' | 'rose-gold' | 'platinum';

const AR_BASE = `${import.meta.env.BASE_URL}assets/ar/`.replace(/\/{2,}/g, '/');

/** sRGB values the AR files were baked with. Used to map arbitrary content.json metals to the closest file. */
const AR_METAL_COLORS: Record<ArMetalKey, string> = {
  'yellow-gold': '#d4af37',
  'white-gold': '#e8eef4',
  'rose-gold': '#c9a08a',
  platinum: '#c2ccd6',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

export function pickArMetal(metal: Pick<RingSwatch, 'id' | 'color'>): ArMetalKey {
  if (metal.id in AR_METAL_COLORS) return metal.id as ArMetalKey;
  const [r, g, b] = hexToRgb(metal.color || '#d4af37');
  let best: ArMetalKey = 'yellow-gold';
  let bestD = Infinity;
  (Object.keys(AR_METAL_COLORS) as ArMetalKey[]).forEach((key) => {
    const [r2, g2, b2] = hexToRgb(AR_METAL_COLORS[key]);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = key;
    }
  });
  return best;
}

/** Bump when public/assets/ar, public/ar or public/mediapipe change: the query makes the URLs safe to cache as `immutable`. */
export const AR_ASSET_VERSION = '1';
export const arGlbUrl = (key: ArMetalKey) => `${AR_BASE}ring-${key}.glb`;
/** Same file, version-stamped: this is the URL the app actually requests (model-viewer and the try-on share one HTTP-cache entry). */
export const arGlbVersionedUrl = (key: ArMetalKey) => `${arGlbUrl(key)}?v=${AR_ASSET_VERSION}`;
export const arUsdzUrl = (key: ArMetalKey) => `${AR_BASE}ring-${key}.usdz`;
/** Per-metal poster/thumbnail (ring-thumb-<metal>.png). */
export const arThumbUrl = (key: ArMetalKey) => `${AR_BASE}ring-thumb-${key}.png`;
export const HAND_MODEL_URL = `${import.meta.env.BASE_URL}ar/hand_landmarker.task`.replace(/\/{2,}/g, '/');
export const MEDIAPIPE_WASM_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`.replace(/\/{2,}/g, '/');

/** Deep link: ?ring=<metalId>,<gemId>[&ar=1|tryon=1] — lets a QR code on desktop open the same ring on a phone. */
export function readRingDeepLink(search: string = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search);
  const [metalId, gemId] = (params.get('ring') ?? '').split(',').map((v) => v.trim());
  return {
    metalId: metalId || null,
    gemId: gemId || null,
    openAr: params.get('ar') === '1',
    openTryOn: params.get('tryon') === '1',
  };
}

export function buildRingShareUrl(metalId: string, gemId: string, mode?: 'ar' | 'tryon'): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('ring', `${metalId},${gemId}`);
  if (mode === 'ar') url.searchParams.set('ar', '1');
  if (mode === 'tryon') url.searchParams.set('tryon', '1');
  return url.toString();
}

export function hexToLinearRgba(hex: string, alpha = 1): [number, number, number, number] {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return [f(r), f(g), f(b), alpha];
}

/** iOS Safari advertises AR Quick Look through <a rel="ar">. */
export function supportsQuickLook(): boolean {
  if (typeof document === 'undefined') return false;
  const a = document.createElement('a');
  return Boolean(a.relList && a.relList.supports && a.relList.supports('ar'));
}
