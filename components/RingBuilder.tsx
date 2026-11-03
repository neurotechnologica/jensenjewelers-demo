import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pickArMetal, readRingDeepLink } from '../lib/ar-assets';
import { warmTryOn } from '../lib/tryon-preload';
import type { RingBuilderConfig, RingSwatch } from '../types/audit';
import { CrystalRingCanvas } from './CrystalRingCanvas';
import { WebGiRingCanvas } from './WebGiRingCanvas';
import { findScroller, hudVisible, isDocked, ringProgress } from '../lib/ring-scroll';
import { assetUrl } from '../lib/asset-url';
import { preloadRingAssets, scheduleAfterLcpIdle } from '../lib/preload-ring';

const posterUrl = assetUrl('assets/plates/plate_hero_ring.webp');

// AR + camera try-on are loaded on demand: model-viewer and MediaPipe never touch the first paint.
const ArViewSheet = lazy(() => import('./ArViewSheet').then((m) => ({ default: m.ArViewSheet })));
const RingTryOn = lazy(() => import('./RingTryOn').then((m) => ({ default: m.RingTryOn })));

interface RingBuilderProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  /** Taller left-rail embed for desktop hero (no cinematic scroll). */
  heroEmbed?: boolean;
  businessName?: string;
}


type RingCanvasProps = React.ComponentProps<typeof CrystalRingCanvas> & {
  progressRef?: React.MutableRefObject<number>;
  active?: boolean;
  onReady?: () => void;
  onContextState?: (state: 'lost' | 'restored') => void;
};

function RingCanvas({ progressRef, active, onReady, onContextState, ...props }: RingCanvasProps) {
  const [useWebGi, setUseWebGi] = useState(true);
  const onFatal = React.useCallback(() => setUseWebGi(false), []);
  // the Crystal fallback has no async load: it is "ready" as soon as it mounts
  useEffect(() => {
    if (!useWebGi) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useWebGi]);
  if (!useWebGi) return <CrystalRingCanvas {...props} />;
  return (
    <WebGiRingCanvas
      {...props}
      progressRef={progressRef}
      active={active}
      onReady={onReady}
      onContextState={onContextState}
      onFatal={onFatal}
    />
  );
}

/** Lower edge of the docked ring as a fraction of the sticky viewport height (measured, iPhone 14 + Pixel). */
const RING_BOTTOM_RATIO = 0.63;
/** The docked ring is ~5-8% wider than a phone screen; 0.84 leaves a small margin on both sides (checked on iPhone 14 / Pixel). */
const RING_PHONE_SCALE = 0.74;

function findSwatch(list: RingSwatch[], id: string, fallback: RingSwatch): RingSwatch {
  return list.find((item) => item.id === id) ?? fallback;
}

function scrollToNextSection() {
  const next =
    document.getElementById('demo') ||
    document.getElementById('roi-calculator') ||
    document.querySelector<HTMLElement>('#ring-studio ~ section');
  next?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export const RingBuilder: React.FC<RingBuilderProps> = ({
  config,
  isDarkMode = false,
  compact = false,
  heroEmbed = false,
  businessName,
}) => {
  const scrollRoot = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const [metalId, setMetalId] = useState(config.defaultMetalId);
  const [gemId, setGemId] = useState(config.defaultGemId);
  // Poster stays up until the first WebGi frame. The runtime starts on a gesture, or on idle after LCP,
  // never on a short timeout (that parsed the 2MB bundle inside the desktop TBT window).
  const [engine, setEngine] = useState(false);
  useEffect(() => scheduleAfterLcpIdle(() => {
    void preloadRingAssets();
    setEngine(true);
  }), []);
  // Scroll state is owned HERE (a passive scroll listener on the section's real scroller), not by the WebGi scene: the HUD and the
  // poster must work even when the 3D scene is still loading, failed, or the user flung past the section before it was ready.
  const [docked, setDocked] = useState(false); // camera docked / ring interactive
  const [hudOn, setHudOn] = useState(false); // studio HUD shown (earlier than the camera dock, and immediately if the scene is not ready)
  const [inView, setInView] = useState(false); // section near the viewport: scene renders; otherwise paused
  const [sceneReady, setSceneReady] = useState(false);
  const sceneReadyRef = useRef(false);
  const hudOnRef = useRef(false);
  const [sheet, setSheet] = useState<'ar' | 'tryon' | null>(null);
  const dockedRef = useRef(false);
  const progressRef = useRef(0);
  const readyTimerRef = useRef(0);
  const lastUiRef = useRef(0);

  // QR / share deep link: ?ring=metal,gem[&ar=1|tryon=1]
  useEffect(() => {
    const link = readRingDeepLink();
    if (link.metalId && config.metals.some((m) => m.id === link.metalId)) setMetalId(link.metalId);
    if (link.gemId && config.gems.some((g) => g.id === link.gemId)) setGemId(link.gemId);
    // The page mounts this component twice (desktop hero rail + phone section, one of them display:none). Only the visible instance may
    // open the deep-linked sheet, otherwise two stacked dialogs open (the lower one inert).
    const visible = (rootRef.current?.getClientRects().length ?? 0) > 0;
    if (!visible) return;
    if (link.openAr) setSheet('ar');
    else if (link.openTryOn) setSheet('tryon');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: how far to lift the ring so its lower edge clears the studio HUD. Measured from layout (offset sizes, unaffected by the
  // HUD's own enter transform). The ring's lower edge sits at ~RING_BOTTOM_RATIO of the sticky viewport height in the docked pose
  // (measured on iPhone 14 / Pixel, see the PR evidence); keep 16 px of air above the HUD card.
  useEffect(() => {
    const sticky = stickyRef.current;
    const hud = hudRef.current;
    if (!sticky || !hud || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const phone = window.matchMedia('(max-width: 639px)').matches;
      const sh = sticky.clientHeight;
      const padBottom = parseFloat(getComputedStyle(hud.parentElement as HTMLElement).paddingBottom) || 0;
      const hudTop = sh - padBottom - hud.offsetHeight;
      // phones: the docked ring is wider than the screen (clipped at both edges) -> shrink it slightly about its own centre, then lift
      const scale = phone ? RING_PHONE_SCALE : 1;
      const originY = sh * 0.42;
      const bottom = originY + (sh * RING_BOTTOM_RATIO - originY) * scale;
      const lift = phone ? Math.max(0, Math.round(bottom - (hudTop - 28))) : 0;
      sticky.style.setProperty('--ring-lift', `${lift}px`);
      sticky.style.setProperty('--ring-scale', String(scale));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(hud);
    ro.observe(sticky);
    return () => ro.disconnect();
  }, []);

  const metal = useMemo(
    () => findSwatch(config.metals, metalId, config.metals[0]),
    [config.metals, metalId]
  );
  const gem = useMemo(
    () => findSwatch(config.gems, gemId, config.gems[0]),
    [config.gems, gemId]
  );

  // Keep labels in sync without React state thrash on every frame
  const progressLabelRef = useRef<HTMLSpanElement | null>(null);
  const phaseLabelRef = useRef<HTMLSpanElement | null>(null);
  const hintLabelRef = useRef<HTMLParagraphElement | null>(null);

  // One passive, rAF-throttled scroll listener on the real scroller. Works with or without the 3D scene.
  const evaluate = React.useCallback((p: number) => {
    const nextDocked = isDocked(p);
    if (nextDocked !== dockedRef.current) {
      dockedRef.current = nextDocked;
      setDocked(nextDocked);
    }
    const nextHud = hudVisible(p, sceneReadyRef.current);
    if (nextHud !== hudOnRef.current) {
      hudOnRef.current = nextHud;
      setHudOn(nextHud);
    }
    const now = performance.now();
    if (now - lastUiRef.current < 120) return; // throttle label DOM writes (~8 fps), never setState per frame
    lastUiRef.current = now;
    if (progressLabelRef.current) progressLabelRef.current.textContent = `${Math.round(p * 100)}%`;
    if (phaseLabelRef.current) phaseLabelRef.current.textContent = p < 0.35 ? '01 Arrive' : p < 0.75 ? '02 Orbit' : '03 Studio';
    if (hintLabelRef.current) hintLabelRef.current.textContent = nextDocked ? 'Customize · drag to turn' : 'Scroll to dock ↓';
  }, []);

  useEffect(() => {
    if (compact || heroEmbed) return;
    const el = scrollRoot.current;
    if (!el) return;
    const scroller = findScroller(el);
    let raf = 0;
    const compute = () => {
      raf = 0;
      const viewH = scroller?.clientHeight || window.innerHeight || 1;
      const top = el.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0);
      const p = ringProgress(top, el.offsetHeight, viewH);
      progressRef.current = p;
      evaluate(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    compute();
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '300px 0px' });
    io.observe(el);
    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [compact, heroEmbed, evaluate]);

  const onSceneReady = React.useCallback(() => {
    sceneReadyRef.current = true;
    setSceneReady(true);
    evaluate(progressRef.current);
  }, [evaluate]);
  const onSceneContext = React.useCallback(
    (state: 'lost' | 'restored') => {
      if (state === 'lost') {
        sceneReadyRef.current = false;
        setSceneReady(false);
        evaluate(progressRef.current);
      }
    },
    [evaluate]
  );

  // intent signals (hover / focus / press) start loading the try-on while the finger is still on its way down
  const warm = () => warmTryOn(pickArMetal(metal));

  const arButtons = (
    <div className="mt-3 flex gap-2 sm:mt-4 sm:flex-wrap" data-testid="ar-actions">
      <button
        type="button"
        onClick={() => setSheet('ar')}
        className="min-h-11 flex-1 rounded-full bg-[#f4efe4] px-3 py-2.5 text-[10px] sm:flex-none sm:px-4 font-bold uppercase tracking-[0.16em] text-[#07080c] active:scale-95"
        data-testid="open-ar"
      >
        View in AR
      </button>
      <button
        type="button"
        onClick={() => setSheet('tryon')}
        onPointerEnter={warm}
        onPointerDown={warm}
        onFocus={warm}
        onTouchStart={warm}
        className="min-h-11 flex-1 rounded-full border border-[#c8b58f] bg-[#0c0b09] px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#faf5ea] active:scale-95 sm:flex-none sm:px-4"
        data-testid="open-tryon"
      >
        Try on your hand
      </button>
    </div>
  );

  const sheets =
    sheet && typeof document !== 'undefined'
      ? createPortal(
          <Suspense fallback={null}>
            {sheet === 'ar' ? (
              <ArViewSheet metal={metal} gem={gem} onClose={() => setSheet(null)} onTryOn={() => setSheet('tryon')} />
            ) : (
              <RingTryOn metal={metal} gem={gem} onClose={() => setSheet(null)} />
            )}
          </Suspense>,
          document.body
        )
      : null;

  // Phones wrap onto extra lines so every metal/stone name is fully on screen. A single nowrap row was clipping
  // "Rose" and "Sapphire" at 390px with the scrollbar hidden, so there was no way to reach the rest.
  const swatchRow = 'flex w-full min-w-0 flex-1 flex-wrap content-start gap-1.5';
  const chipClass = (active: boolean, accent: 'copper' | 'ice') =>
    `inline-flex max-w-full shrink-0 items-center gap-1.5 overflow-visible whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
      active
        ? 'border-[#0c0b09] bg-[#0c0b09] text-[#faf5ea]'
        : 'border-[#1a1714]/30 bg-[#faf5ea] text-[#1a1714]'
    }`;

  if (compact || heroEmbed) {
    const shell = heroEmbed
      ? 'liquid-glass relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.32)] bg-[rgba(12,11,9,0.48)] p-4 backdrop-blur-xl sm:p-5'
      : 'liquid-glass relative overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.28)] bg-[rgba(12,11,9,0.72)] p-4 backdrop-blur-xl';
    const canvasH = heroEmbed
      ? 'relative mt-3 min-h-[380px] flex-1 w-full overflow-hidden rounded-2xl'
      : 'relative mt-3 h-[340px] w-full overflow-hidden rounded-2xl';
    return (
      <div className={shell} ref={rootRef}>
        <p className="fx-kicker">{businessName ? `${businessName} · ` : ''}Showroom demo</p>
        <p className="mt-1 text-[11px] text-[#a8957a]">
          {heroEmbed ? 'Drag to orbit · swap metal & stone' : '3D ring · not the voice SOP'}
        </p>
        <div className={`${canvasH} bg-[#0c0b09]`} style={{ touchAction: 'pan-y' }}>
          <img
            src={posterUrl}
            alt=""
            width={1280}
            height={720}
            decoding="async"
            fetchPriority="high"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${sceneReady ? 'opacity-0' : 'opacity-80'}`}
          />
          {engine ? (
          <RingCanvas
            metalColor={metal.color}
            gemColor={gem.color}
            mode="orbit"
            interactive={heroEmbed || compact}
            onReady={() => setSceneReady(true)}
          />
          ) : null}
        </div>
        <p className="fx-kicker mt-4">Metal</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Metal">
          {config.metals.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMetalId(item.id)}
              aria-pressed={metalId === item.id}
              className={chipClass(metalId === item.id, 'copper')}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
        <p className="fx-kicker mt-4">Center stone</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Center stone">
          {config.gems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGemId(item.id)}
              aria-pressed={gemId === item.id}
              className={chipClass(gemId === item.id, 'ice')}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
        {arButtons}
        {sheets}
      </div>
    );
  }

  // —— One continuous scene: short scroll → same ring docks → HUD customize ——
  return (
    <div className="relative" ref={rootRef}>
      <div ref={scrollRoot} data-testid="ring-scroll-track" className="relative h-[112vh] sm:h-[160vh]">
        <div
          ref={stickyRef}
          className="sticky top-0 z-[1] h-[100svh] min-h-[100svh] w-full overflow-hidden bg-[#0c0b09]"
          style={{ touchAction: 'pan-y' }}
        >
          {/* Docked on phones the studio HUD covers the lower part of the screen: lift the (full-size) canvas by a measured amount so the
              ring sits entirely above it. transform only (compositor), animated once when the ring docks; no canvas resize, no camera jump. */}
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{ transformOrigin: '50% 42%', transform: hudOn ? `translate3d(0, calc(var(--ring-lift, 0px) * -1), 0) scale(var(--ring-scale, 1))` : 'translate3d(0,0,0) scale(1)', willChange: hudOn ? 'transform' : undefined }}
            data-testid="ring-lift"
          >
            {/* Poster / loading placeholder: same box as the canvas (absolute, no layout change), visible from the first paint until the
                first WebGi frame is drawn - and again if the GL context is lost. The HUD below does not wait for it. */}
            <div
              aria-hidden
              data-testid="ring-poster"
              data-ready={sceneReady ? '1' : '0'}
              className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${sceneReady ? 'opacity-0' : 'opacity-100'}`}
              style={{ background: 'radial-gradient(circle at 42% 44%, #1a1410 0%, #0c0b09 70%)' }}
            >
              <img src={posterUrl} alt="" decoding="async" className="h-full w-full object-cover opacity-70 mix-blend-lighten" />
              {!sceneReady ? (
                <p className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[#c8b58f]">Preparing the studio…</p>
              ) : null}
            </div>
            {engine ? (
            <RingCanvas
              metalColor={metal.color}
              gemColor={gem.color}
              mode="scroll"
              interactive={docked}
              scrollRoot={scrollRoot}
              progressRef={progressRef}
              active={inView && !sheet}
              onReady={onSceneReady}
              onContextState={onSceneContext}
              dockAt={0.78}
              className="absolute inset-0"
            />
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_48%,rgba(58,36,28,0.18),transparent_42%)]" />
          <div
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-48 transition-opacity duration-500 ${
              hudOn ? 'opacity-90' : 'opacity-70'
            } bg-gradient-to-t from-[#0c0b09] via-[#0c0b09]/70 to-transparent`}
          />

          {/* Entry chrome — fades as ring docks */}
          <div
            className={`relative z-10 flex h-full flex-col justify-between p-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:p-10 md:pb-10 transition-opacity duration-500 ${
              hudOn ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="max-w-sm">
              <p className="fx-kicker">
                {businessName ? `${businessName} · ` : ''}Showroom demo
              </p>
              <h3 className="fx-display mt-2 text-[1.65rem] leading-[0.95] text-[#f4efe4] sm:text-3xl md:text-4xl">
                {config.headline}
              </h3>
              <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-[#ddd4c6]">
                One short scroll docks this ring into the studio — then customize metal and stone.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="fx-chip">
                  <span className="fx-dot" />
                  <span ref={phaseLabelRef}>01 Arrive</span>
                </span>
                <span className="fx-chip">
                  <span ref={progressLabelRef}>0%</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p
                ref={hintLabelRef}
                className="pointer-events-none text-[11px] uppercase tracking-[0.22em] text-[#c8b58f]/90"
              >
                Scroll to dock ↓
              </p>
              <div className="pointer-events-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = scrollRoot.current;
                    if (!el) return;
                    let scroller: HTMLElement | null = el.parentElement;
                    while (scroller) {
                      const oy = getComputedStyle(scroller).overflowY;
                      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') break;
                      scroller = scroller.parentElement;
                    }
                    const range = Math.max(1, el.offsetHeight - (scroller?.clientHeight || window.innerHeight));
                    if (scroller) {
                      const target = scroller.scrollTop + el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + range;
                      scroller.scrollTo({ top: target, behavior: 'smooth' });
                    } else {
                      const top = el.getBoundingClientRect().top + window.scrollY;
                      window.scrollTo({ top: top + range, behavior: 'smooth' });
                    }
                  }}
                  className="min-h-11 rounded-full border border-[#c8b58f]/50 bg-white/5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f4efe4] backdrop-blur-md active:scale-95"
                >
                  Jump to studio
                </button>
                <button
                  type="button"
                  onClick={scrollToNextSection}
                  className="min-h-11 rounded-full border border-white/20 bg-black/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ddd4c6] backdrop-blur-md active:scale-95"
                >
                  Skip section
                </button>
              </div>
            </div>
          </div>

          {/* Studio HUD — same canvas, same ring, customize overlay */}
          <div
            id="ring-studio-interact"
            className={`absolute inset-0 z-20 flex flex-col justify-end p-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-8 transition-all duration-500 ${
              hudOn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
            data-hud-on={hudOn ? '1' : '0'}
          >
            <div
              ref={hudRef}
              className="liquid-glass mx-auto w-[min(100%,32rem)] min-w-0 max-w-full overflow-visible rounded-2xl border border-[rgba(200,181,143,0.35)] bg-[rgba(12,11,9,0.55)] p-3 backdrop-blur-xl shadow-[0_-12px_48px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4"
              data-testid="ring-hud"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="fx-kicker text-[#c8b58f]">Ring Builder</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#ddd4c6]">
                    {metal.label} · {gem.label} · drag to turn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={scrollToNextSection}
                  className="min-h-10 shrink-0 rounded-full bg-[#f4efe4] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#07080c] active:scale-95"
                >
                  Continue ↓
                </button>
              </div>
              {/* Phones: one horizontally scrollable row per group (label inline) so the card stays short and the ring stays visible */}
              <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:block">
                <p className="fx-kicker w-11 shrink-0 sm:w-auto">Metal</p>
                <div className={swatchRow} role="group" aria-label="Metal">
                  {config.metals.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMetalId(item.id)}
                      aria-pressed={metalId === item.id}
                      className={`${chipClass(metalId === item.id, 'copper')} shrink-0`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 sm:mt-3 sm:block">
                <p className="fx-kicker w-11 shrink-0 leading-tight sm:w-auto">Stone</p>
                <div className={swatchRow} role="group" aria-label="Center stone">
                  {config.gems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGemId(item.id)}
                      aria-pressed={gemId === item.id}
                      className={`${chipClass(gemId === item.id, 'ice')} shrink-0`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {arButtons}
              <p className="mt-3 hidden text-[11px] leading-relaxed text-[#a8957a] sm:block">{config.subhead}</p>
            </div>
          </div>
        </div>
      </div>
      {sheets}
    </div>
  );
};
