/**
 * ONE shared WebGL renderer for every DottedSurface on the page.
 *
 * Before: each DottedSurface owned a THREE.WebGLRenderer (4 on the homepage + 1 in the splash, DPR up to 2, a rAF loop each, never paused).
 * Together with the WebGi ring canvas that was 5-6 simultaneous WebGL contexts, which is what mobile Safari / Chrome kill first
 * ("a problem occurred with this webpage" when scrolling to the bottom). Now: one off-DOM renderer, drawn only while an instance is on
 * screen, blitted into a plain 2D canvas per instance (2D canvases keep their last frame, so there is no flash when scrolling fast).
 */
import * as THREE from 'three';

export const SEPARATION = 100;
export const AMOUNTX = 30;
export const AMOUNTY = 28;

export interface DottedInstance {
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  posArray: Float32Array;
  posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  visible: boolean;
  /** step the wave (mutates positions) */
  step: (count: number) => void;
  /** a frame must be drawn even if static (first paint, resize, reduced motion) */
  dirty: boolean;
  animated: boolean;
}

/** Pure: wave height for a grid cell. Exported for tests. */
export function dotHeight(ix: number, iy: number, count: number): number {
  return Math.sin((ix + count) * 0.22) * 42 + Math.sin((iy + count) * 0.35) * 42;
}

/** Pure: pixel ratio for the dotted canvases. Phones are capped low: the dots are soft blobs, they never need retina sharpness. */
export function dottedPixelRatio(dpr: number, coarse: boolean): number {
  return Math.min(dpr || 1, coarse ? 1.25 : 2);
}

/** Pure: frame interval in ms (30 fps on phones: it is a slow wave). */
export function dottedFrameInterval(coarse: boolean): number {
  return coarse ? 1000 / 30 : 1000 / 60;
}

const instances = new Set<DottedInstance>();
let renderer: THREE.WebGLRenderer | null = null;
let raf = 0;
let lastFrame = 0;
let count = 0;
let contextLost = false;
let failed = false;
export const dottedStats = { renderersCreated: 0, contextLosses: 0, contextRestores: 0, frames: 0 };

const isCoarse = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);

function ensureRenderer(): THREE.WebGLRenderer | null {
  if (renderer || failed) return renderer;
  try {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(1);
    const el = r.domElement;
    el.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // allow restore
      contextLost = true;
      dottedStats.contextLosses++;
      stopLoop();
    });
    el.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      dottedStats.contextRestores++;
      instances.forEach((i) => (i.dirty = true));
      startLoop();
    });
    renderer = r;
    dottedStats.renderersCreated++;
  } catch {
    failed = true; // no WebGL: the surfaces simply stay blank (they are decoration)
  }
  return renderer;
}

function frame(now: number) {
  raf = 0;
  if (!renderer || contextLost || document.hidden) return;
  const active = [...instances].filter((i) => i.visible);
  if (!active.length) return; // nothing on screen: loop stops, restarted by the IntersectionObserver
  raf = requestAnimationFrame(frame);
  const coarse = isCoarse();
  if (now - lastFrame < dottedFrameInterval(coarse) - 1) return;
  lastFrame = now;
  const anyAnimated = active.some((i) => i.animated);
  if (anyAnimated) count += 0.055 * (coarse ? 2 : 1);
  let drew = false;
  for (const inst of active) {
    if (!inst.animated && !inst.dirty) continue;
    const w = inst.canvas.width;
    const h = inst.canvas.height;
    if (w < 2 || h < 2) continue;
    const el = renderer.domElement;
    // grow-only shared drawing buffer; render with a viewport so we never resize between instances
    if (el.width < w || el.height < h) renderer.setSize(Math.max(el.width, w), Math.max(el.height, h), false);
    inst.step(count);
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(inst.scene, inst.camera);
    inst.ctx2d.clearRect(0, 0, w, h);
    inst.ctx2d.drawImage(el, 0, el.height - h, w, h, 0, 0, w, h);
    inst.dirty = false;
    drew = true;
  }
  if (drew) dottedStats.frames++;
  // static (reduced motion) instances were drawn once: stop looping when nothing animates
  if (!anyAnimated && !active.some((i) => i.dirty)) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

export function startLoop() {
  if (raf || contextLost || typeof document === 'undefined') return;
  raf = requestAnimationFrame(frame);
}
function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
}

export function registerDotted(inst: DottedInstance): (() => void) | null {
  if (!ensureRenderer()) return null;
  instances.add(inst);
  startLoop();
  return () => {
    instances.delete(inst);
    inst.scene.traverse((o) => {
      const m = o as THREE.Points;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    if (!instances.size) {
      stopLoop();
      // last surface gone (e.g. navigated to another view): release the context and its buffers
      try {
        renderer?.dispose();
        renderer?.forceContextLoss();
      } catch {
        /* ignore */
      }
      renderer = null;
    }
  };
}

export function kickDotted() {
  startLoop();
}
