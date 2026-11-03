import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { RingBuilderConfig } from '../types/audit';
import { assetUrl } from '../lib/asset-url';
import { scheduleAfterLcpIdle } from '../lib/preload-ring';
import { ErrorBoundary } from './ErrorBoundary';

const RingBuilder = lazy(() => import('./RingBuilder').then((m) => ({ default: m.RingBuilder })));
const POSTER = assetUrl('assets/plates/plate_hero_ring.webp');

interface LazyRingBuilderSectionProps {
  config: Required<RingBuilderConfig>;
  isDarkMode?: boolean;
  compact?: boolean;
  heroEmbed?: boolean;
  /** Mount immediately (mobile scroll journey) — skip IO gate. */
  eager?: boolean;
  businessName?: string;
}

/**
 * Poster first. The RingBuilder chunk (three.js) loads after a gesture, when the section
 * is near the viewport, or once the browser is idle — not during the first paint.
 * webgi itself stays a dynamic import inside WebGiRingCanvas.
 */
export const LazyRingBuilderSection: React.FC<LazyRingBuilderSectionProps> = (props) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dead = false;
    const show = () => { if (!dead) setVisible(true); };
    if (props.eager) { show(); return; }
    if (props.heroEmbed) {
      // Desktop hero is on screen. Keep the poster until a gesture, or until idle after LCP.
      const stop = scheduleAfterLcpIdle(show);
      return () => { dead = true; stop(); };
    }
    const opts = { once: true, passive: true } as const;
    // Below the fold: a gesture, or the section actually entering the viewport. No idle timer during LCP.
    window.addEventListener('pointerdown', show, opts);
    let observer: IntersectionObserver | undefined;
    const node = hostRef.current;
    if (node) {
      observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) show();
      }, { rootMargin: '0px' });
      observer.observe(node);
    }
    return () => {
      dead = true;
      window.removeEventListener('pointerdown', show);
      observer?.disconnect();
    };
  }, [props.heroEmbed, props.eager]);

  const placeholderClass = `rounded-[2rem] border px-6 py-16 text-center text-xs uppercase tracking-[0.22em] ${
    props.isDarkMode ? 'border-white/10 text-slate-500' : 'border-navy-200 text-navy-500'
  }`;

  const fallback = (
    <div className={`rounded-[2rem] border px-6 py-12 text-center ${
      props.isDarkMode ? 'border-amber-300/30 bg-navy-950/50 text-slate-300' : 'border-navy-200 bg-white/70 text-navy-700'
    }`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200/80">
        Ring studio preview unavailable
      </p>
      <p className="mt-3 text-sm normal-case tracking-normal">
        3D assets could not load in this environment. Use the audit or book a call — the rest of the site works normally.
      </p>
    </div>
  );

  return (
    <div ref={hostRef} className="min-h-[240px]">
      {visible ? (
        <ErrorBoundary label="Ring Builder" fallback={fallback}>
          <Suspense fallback={<img src={POSTER} alt="" width={1280} height={720} decoding="async" className="h-full min-h-[240px] w-full object-cover" />}>
            <RingBuilder {...props} />
          </Suspense>
        </ErrorBoundary>
      ) : (
        <img src={POSTER} alt="" width={1280} height={720} decoding="async" className={`${placeholderClass} h-full min-h-[240px] w-full object-cover`} />
      )}
    </div>
  );
};
