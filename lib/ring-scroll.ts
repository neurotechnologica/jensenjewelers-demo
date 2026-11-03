/** Scroll helpers for the Ring Builder journey (kept pure so they can be unit-tested; the scene itself never owns the HUD state). */

export const RING_DOCK_AT = 0.78;
/** The studio HUD appears from here when the 3D scene is ready ... */
export const RING_HUD_AT = 0.5;
/** ... and from here when it is NOT ready (still loading / failed / context lost): the HUD + poster must never be skipped. */
export const RING_HUD_AT_NOT_READY = 0.08;

export function clamp01(v: number): number {
  return !(v > 0) ? 0 : v > 1 ? 1 : v; // NaN and -0 -> 0
}

/**
 * Journey progress 0..1 of a tall section with a sticky stage inside a scroller.
 * @param top        section top relative to the scroller's visible top (px, negative once scrolled into it)
 * @param sectionH   section height (px)
 * @param viewH      scroller viewport height (px)
 */
export function ringProgress(top: number, sectionH: number, viewH: number): number {
  const range = Math.max(1, sectionH - viewH);
  return clamp01(-top / range);
}

export function hudVisible(progress: number, sceneReady: boolean): boolean {
  return progress >= (sceneReady ? RING_HUD_AT : RING_HUD_AT_NOT_READY);
}

export function isDocked(progress: number): boolean {
  return progress >= RING_DOCK_AT;
}

/** Nearest ancestor that actually scrolls (the app scrolls a div, not the window). */
export function findScroller(el: HTMLElement | null): HTMLElement | null {
  let s: HTMLElement | null = el?.parentElement ?? null;
  while (s) {
    const oy = getComputedStyle(s).overflowY;
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return s;
    s = s.parentElement;
  }
  return null;
}

/** Pure: pixel-ratio cap. Phones/tablets (coarse pointer) are capped at 1.5, desktops at 2. */
export function ringPixelRatio(dpr: number, coarse: boolean): number {
  return Math.min(dpr || 1, coarse ? 1.5 : 2);
}
