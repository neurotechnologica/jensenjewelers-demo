/**
 * WebGi ViewerApp + DiamondPlugin canvas — matches VikasRana10/3D-app diamond pipeline.
 * Falls through parent ErrorBoundary to CrystalRingCanvas if webgi fails at runtime.
 */
import React, { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../lib/asset-url';
import { ringPixelRatio } from '../lib/ring-scroll';

const RING_URL = assetUrl('assets/3D/ring_webgi.glb');

type Vec3 = [number, number, number];

/** Camera path aligned to Vikas ScrollTrigger keys + config dock (pulled back for HUD). */
const SCROLL_KEYS: { pos: Vec3; target: Vec3; rot: Vec3 }[] = [
  { pos: [1.28, -1.7, 5.86], target: [0.91, 0.03, -0.25], rot: [0, 0, 0] },
  { pos: [-1.83, -0.14, 6.15], target: [-0.78, -0.03, -0.12], rot: [0, 0, Math.PI / 2] },
  { pos: [-0.06, -1.15, 4.42], target: [-0.01, 0.9, 0.07], rot: [0, 0, -Math.PI / 2] },
  { pos: [-0.17, -0.25, 6.2], target: [0, 0.15, 0], rot: [-Math.PI / 3, 0, -Math.PI / 2.4] },
  // Docked studio — pulled back so the band is fully in frame at 390 and 1280, sitting above the HUD.
  { pos: [-0.17, 0.95, 10.6], target: [0, -0.72, 0], rot: [-Math.PI / 2.2, 0, -Math.PI / 2] },
];

/** Orbit (desktop hero / 1280): centered in the canvas, not the mobile HUD pose. */
const ORBIT_POSE: { pos: Vec3; target: Vec3; rot: Vec3 } = {
  pos: [-0.1, 0.28, 10.8],
  target: [0, 0.05, 0],
  rot: [-Math.PI / 2.2, 0, -Math.PI / 2],
};

const DOCK_AT = 0.78;
const DIAMOND_NAMES = ['diamonds', 'diamonds001', 'diamonds002', 'diamonds003', 'diamonds004', 'diamonds005', 'Object'];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function sampleScroll(progress: number) {
  const clamped = Math.min(1, Math.max(0, progress));
  const eased = easeInOutCubic(clamped);
  const scaled = eased * (SCROLL_KEYS.length - 1);
  const i = Math.min(SCROLL_KEYS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const from = SCROLL_KEYS[i];
  const to = SCROLL_KEYS[i + 1];
  return {
    pos: lerpVec(from.pos, to.pos, t),
    target: lerpVec(from.target, to.target, t),
    rot: lerpVec(from.rot, to.rot, t),
  };
}

function isPaleMetal(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62;
}

interface WebGiRingCanvasProps {
  metalColor: string;
  gemColor: string;
  mode?: 'scroll' | 'orbit';
  interactive?: boolean;
  scrollRoot?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Raw 0-1 scroll progress through the section, written by the parent (RingBuilder owns the scroll listener, so the HUD never depends on this scene). */
  progressRef?: React.MutableRefObject<number>;
  /** Section is on (or near) screen. When false the render loop and the WebGi pipeline are paused. */
  active?: boolean;
  /** Fired once the first frame of the scene is ready to show (hide the poster). */
  onReady?: () => void;
  /** Fired when the GL context is lost (show the poster again) / restored. */
  onContextState?: (state: 'lost' | 'restored') => void;
  dockAt?: number;
  onFatal?: () => void;
}



export const WebGiRingCanvas: React.FC<WebGiRingCanvasProps> = ({
  metalColor,
  gemColor,
  mode = 'orbit',
  interactive,
  scrollRoot,
  className = '',
  progressRef,
  active = true,
  onReady,
  onContextState,
  dockAt = DOCK_AT,
  onFatal,
}) => {
  const wantInteract = interactive ?? mode === 'orbit';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const metalRef = useRef(metalColor);
  const gemRef = useRef(gemColor);
  const interactiveRef = useRef(wantInteract);
  const progressRefRef = useRef(progressRef);
  const activeRef = useRef(active);
  const wakeRef = useRef<(() => void) | null>(null);
  const onReadyRef = useRef(onReady);
  const onCtxRef = useRef(onContextState);
  const lossCountRef = useRef(0);
  const [epoch, setEpoch] = useState(0);
  const dockAtRef = useRef(dockAt);
  const onFatalRef = useRef(onFatal);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  metalRef.current = metalColor;
  gemRef.current = gemColor;
  interactiveRef.current = wantInteract;
  progressRefRef.current = progressRef;
  onReadyRef.current = onReady;
  onCtxRef.current = onContextState;
  activeRef.current = active;
  dockAtRef.current = dockAt;
  onFatalRef.current = onFatal;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    setLoadState('loading');
    let cancelled = false;
    let raf = 0;
    const disposers: Array<() => void> = [];
    let viewer: any = null;
    let resizeObs: ResizeObserver | null = null;

    const waitForSize = () =>
      new Promise<void>((resolve) => {
        const ready = () => host.clientWidth >= 32 && host.clientHeight >= 32;
        if (ready()) {
          resolve();
          return;
        }
        resizeObs = new ResizeObserver(() => {
          if (ready()) {
            resizeObs?.disconnect();
            resolve();
          }
        });
        resizeObs.observe(host);
        // Cap wait — if still hidden, abort (parent should not mount us hidden)
        window.setTimeout(() => {
          if (!cancelled) resolve();
        }, 4000);
      });

    // GL context loss (iOS Safari / Android evict contexts under memory pressure): keep the page alive, show the poster, and rebuild
    // the viewer on restore. Without preventDefault() the context is never restored.
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      lossCountRef.current += 1;
      onCtxRef.current?.('lost');
    };
    const onRestored = () => {
      onCtxRef.current?.('restored');
      if (lossCountRef.current <= 3) setEpoch((n) => n + 1); // re-run this effect: fresh viewer on the restored context
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    let ring: any = null;
    let gold: any = null;
    let silver: any = null;
    let diamonds: any[] = [];
    let ColorCtor: any = null;

    let colorKey = '';
    const applyColors = () => {
      if (!ColorCtor) return;
      const key = `${metalRef.current}|${gemRef.current}`;
      if (key === colorKey) return; // colours only touch the (heavy) pipeline when they actually change
      colorKey = key;
      try {
        const metal = metalRef.current;
        const gem = gemRef.current;
        if (gold?.material?.color) {
          gold.material.color.copy(new ColorCtor(metal).convertSRGBToLinear());
          gold.material.colorNeedsUpdate = true;
        }
        if (silver?.material?.color) {
          const accent = isPaleMetal(metal) ? metal : '#f3f1ec';
          silver.material.color.copy(new ColorCtor(accent).convertSRGBToLinear());
          silver.material.colorNeedsUpdate = true;
        }
        for (const o of diamonds) {
          if (o?.material?.color) {
            o.material.color.copy(new ColorCtor(gem).convertSRGBToLinear());
            o.material.colorNeedsUpdate = true;
          }
        }
        viewer?.setDirty?.();
      } catch (e) {
        console.warn('[WebGiRingCanvas] color apply', e);
      }
    };

    (async () => {
      try {
        await waitForSize();
        if (cancelled) return;
        if (host.clientWidth < 32 || host.clientHeight < 32) {
          // Hidden / zero-size mount (e.g. desktop hero on mobile) — bail cleanly
          setLoadState('error');
          onFatalRef.current?.();
          return;
        }
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        const webgi = await import('webgi');
        if (cancelled) return;
        await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
        if (cancelled) return;
        ColorCtor = webgi.Color;
        const {
          ViewerApp,
          AssetManagerPlugin,
          GBufferPlugin,
          ProgressivePlugin,
          TonemapPlugin,
          SSRPlugin,
          SSAOPlugin,
          FrameFadePlugin,
          GroundPlugin,
          BloomPlugin,
          TemporalAAPlugin,
          DiamondPlugin,
          RandomizedDirectionalLightPlugin,
          mobileAndTabletCheck,
        } = webgi;

        const isMobile = mobileAndTabletCheck?.() ?? window.innerWidth < 768;
        // MSAA on for mobile reduces diamond/metal speckles; TemporalAA still runs for desktop quality
        viewer = new ViewerApp({
          canvas,
          useGBufferDepth: true,
          isAntialiased: true,
        });
        // One pixel-ratio cap for the whole pipeline (canvas + G-buffer + MSAA targets all scale with it): 1.5 on phones/tablets instead of 2
        // cuts the estimated render-target memory by ~44% (see PR evidence).
        const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? isMobile;
        viewer.renderer.displayCanvasScaling = ringPixelRatio(window.devicePixelRatio, coarse || isMobile);

        await viewer.addPlugin(AssetManagerPlugin);
        await viewer.addPlugin(GBufferPlugin);
        // More progressive frames = less sparkle/noise on diamonds & metal
        await viewer.addPlugin(new ProgressivePlugin(isMobile ? 48 : 40));
        await viewer.addPlugin(new TonemapPlugin(true));
        const ssr = await viewer.addPlugin(SSRPlugin);
        const ssao = await viewer.addPlugin(SSAOPlugin);
        await viewer.addPlugin(FrameFadePlugin);
        await viewer.addPlugin(GroundPlugin);
        const bloom = await viewer.addPlugin(BloomPlugin);
        await viewer.addPlugin(TemporalAAPlugin);
        await viewer.addPlugin(DiamondPlugin);
        await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
        if (cancelled) return;
        await viewer.addPlugin(RandomizedDirectionalLightPlugin, false);

        try {
          if (ssr?.passes?.ssr?.passObject) {
            ssr.passes.ssr.passObject.lowQualityFrames = 0;
            if (typeof ssr.passes.ssr.passObject.intensity === 'number') {
              ssr.passes.ssr.passObject.intensity = isMobile ? 0.35 : 0.85;
            }
          }
          if (bloom?.pass?.passObject) bloom.pass.passObject.bloomIterations = isMobile ? 1 : 2;
          if (ssao?.passes?.ssao?.passObject?.material?.defines) {
            ssao.passes.ssao.passObject.material.defines.NUM_SAMPLES = isMobile ? 2 : 4;
          }
          // Mobile: mute SSAO + SSR + Bloom — primary sources of dotted metal/diamond sparkle
          if (isMobile) {
            if (ssao) ssao.enabled = false;
            if (ssr) ssr.enabled = false;
            if (bloom) bloom.enabled = false;
          }
        } catch {
          /* plugin internals vary by build */
        }

        viewer.setBackground(new ColorCtor('#0c0b09').convertSRGBToLinear());
        viewer.renderer.refreshPipeline();

        const manager = viewer.getPlugin(AssetManagerPlugin);
        await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
        if (cancelled) return;
        await manager.addFromPath(RING_URL);
        if (cancelled) return;

        const find = (name: string) => viewer.scene.findObjectsByName(name)?.[0];
        ring = find('Scene') || find('ring-compare') || viewer.scene.modelRoot;
        gold = find('gold') || find('entourage');
        silver = find('silver') || find('alliance');
        diamonds = [];
        for (const n of DIAMOND_NAMES) {
          const o = find(n);
          if (o) diamonds.push(o);
        }

        const camera = viewer.scene.activeCamera;
        if (camera?.controls) camera.controls.enabled = false;
        if (mode === 'orbit' && camera?.setCameraOptions) {
          camera.setCameraOptions({ fov: isMobile ? 44 : 36 });
        } else if (camera?.setCameraOptions) {
          camera.setCameraOptions({ fov: isMobile ? 38 : 28 });
        }

        applyColors();
        setLoadState('ready');

        let smoothed = mode === 'scroll' ? Math.min(1, Math.max(0, progressRefRef.current?.current ?? 0)) : 1; // start AT the current progress: no catch-up sweep from 0
        let wasDocked = mode !== 'scroll';
        let orbitY = 0;
        let dragging = false;
        let lastX = 0;

        const onPointerDown = (e: PointerEvent) => {
          if (!interactiveRef.current) return;
          dragging = true;
          lastX = e.clientX;
          canvas.setPointerCapture(e.pointerId);
        };
        const onPointerUp = (e: PointerEvent) => {
          dragging = false;
          if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        };
        const onPointerMove = (e: PointerEvent) => {
          if (!dragging || !interactiveRef.current) return;
          orbitY += (e.clientX - lastX) * 0.01;
          lastX = e.clientX;
        };
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointercancel', onPointerUp);
        disposers.push(() => {
          canvas.removeEventListener('pointerdown', onPointerDown);
          canvas.removeEventListener('pointerup', onPointerUp);
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointercancel', onPointerUp);
        });

        const step = () => {
          const cam = viewer.scene.activeCamera;
          if (!cam) return;
          let posed = false;
          if (mode === 'scroll') {
            const raw = Math.min(1, Math.max(0, progressRefRef.current?.current ?? 1));
            const prev = smoothed;
            smoothed += (raw - smoothed) * 0.22;
            if (Math.abs(raw - smoothed) < 0.0008) smoothed = raw;
            const dockT = dockAtRef.current;
            const pathT = Math.min(smoothed / dockT, 1);
            const isDock = smoothed >= dockT;
            if (isDock !== wasDocked) {
              wasDocked = isDock;
              if (cam.controls) cam.controls.enabled = false;
            }
            if (isDock) {
              const dock = SCROLL_KEYS[SCROLL_KEYS.length - 1];
              if (interactiveRef.current) {
                if (!dragging) orbitY += 0.0025;
                ring?.rotation?.set(dock.rot[0], dock.rot[1] + orbitY, dock.rot[2]);
                posed = true; // spinning
              } else if (prev !== smoothed || ring?.rotation?.y !== dock.rot[1]) {
                ring?.rotation?.set(...dock.rot);
                posed = true;
              }
              if (prev !== smoothed || posed) {
                cam.position.set(...dock.pos);
                cam.target.set(...dock.target);
                posed = true;
              }
            } else if (prev !== smoothed || !wasPosed) {
              const sample = sampleScroll(pathT);
              cam.position.set(...sample.pos);
              cam.target.set(...sample.target);
              if (ring?.rotation) ring.rotation.set(...sample.rot);
              posed = true;
            }
          } else {
            const dock = ORBIT_POSE;
            cam.position.set(...dock.pos);
            cam.target.set(...dock.target);
            if (!dragging) orbitY += 0.004;
            ring?.rotation?.set(dock.rot[0], dock.rot[1] + orbitY, dock.rot[2]);
            if (cam.controls) cam.controls.enabled = false;
            posed = true;
          }
          if (posed) {
            wasPosed = true;
            cam.positionUpdated?.(false);
            cam.targetUpdated?.(true);
            viewer.setDirty?.();
          }
          applyColors();
        };
        let wasPosed = false;

        // Render loop that only runs while the section is on screen and the tab is visible. Offscreen = no JS, no WebGi frames (viewer
        // renderEnabled=false), which is what removes the scroll jank on the rest of the page.
        const canRun = () => !cancelled && viewer && activeRef.current && !document.hidden;
        const loop = () => {
          raf = 0;
          if (!canRun()) {
            if (viewer) viewer.renderEnabled = false;
            return;
          }
          raf = requestAnimationFrame(loop);
          step();
        };
        let readySent = false;
        const sendReady = () => {
          if (readySent) return;
          readySent = true;
          // two rAFs: the first pipeline frame has been drawn; only then drop the poster (no flash of an empty canvas)
          requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && onReadyRef.current?.()));
        };
        const wake = () => {
          if (raf || !canRun()) return;
          sendReady();
          viewer.renderEnabled = true;
          wasPosed = false;
          viewer.setDirty?.();
          raf = requestAnimationFrame(loop);
        };
        wakeRef.current = wake;
        const onVis = () => (document.hidden ? undefined : wake());
        document.addEventListener('visibilitychange', onVis);
        disposers.push(() => document.removeEventListener('visibilitychange', onVis));
        step();
        wake();
        if (!activeRef.current) viewer.renderEnabled = false; // scene is built but offscreen: stays paused until the section is near the viewport


        const onResize = () => {
          viewer?.resize?.();
        };
        window.addEventListener('resize', onResize);
        const hostResizeObs = new ResizeObserver(() => {
          viewer?.resize?.();
        });
        hostResizeObs.observe(host);

        disposers.push(() => {
          hostResizeObs.disconnect();
          window.removeEventListener('resize', onResize);
        });
        if (cancelled) disposers.splice(0).forEach((d) => d());
      } catch (err) {
        console.error('[WebGiRingCanvas] init failed', err);
        if (!cancelled) {
          setLoadState('error');
          onFatalRef.current?.();
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      disposers.splice(0).forEach((d) => d());
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      resizeObs?.disconnect();
      try {
        viewer?.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, [mode, scrollRoot, epoch]); // onFatal / progress / active via refs — never reinit the viewer for those

  // Section came back on screen: restart the loop (it stops itself offscreen). Colour changes are picked up by the next step().
  useEffect(() => {
    if (active) wakeRef.current?.();
  }, [active]);

  return (
    <div
      ref={hostRef}
      className={`relative ${className}`}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'pan-y' /* vertical swipes over the ring must still scroll the page; horizontal drags orbit it */,
        pointerEvents: wantInteract ? 'auto' : 'none',
        cursor: wantInteract ? 'grab' : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        id={`webgi-canvas-${mode}`}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label={
          wantInteract
            ? 'Interactive 3D ring with WebGi diamonds. Drag to rotate.'
            : 'Scroll-driven WebGi diamond ring. Scroll to dock into the studio.'
        }
      />
      {loadState === 'loading' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#c8b58f]">
          Loading WebGi diamonds
        </p>
      ) : null}
      {loadState === 'error' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-300">
          WebGi failed
        </p>
      ) : null}
    </div>
  );
};
