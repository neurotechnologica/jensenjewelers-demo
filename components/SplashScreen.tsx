import React, { useState, useEffect, useRef } from 'react';
import { PhoneCall } from 'lucide-react';
import DisplayCards from './ui/display-cards';
import fcShad from '../public/assets/fcshad.png';
import { splashTrioLayout } from '../lib/splash-layout';

const STATS = [
  "Jewelers lose 40% of leads to missed calls.",
  "Custom ring inquiries peak between 8 PM and 11 PM.",
  "92% of high-end clients expect instant booking confirmation.",
  "AI response times are 120x faster than traditional front desks.",
  "One missed $5k sale covers 18 months of Fourcee service."
];

/** Same trio as homepage "Silence is Expensive" — beige/black for splash. */
const SPLASH_OPPORTUNITY_CARDS = [
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$12,000 Anniversary Inquiry",
    date: "Sunday, 8:14 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] backdrop-blur-none -translate-y-6 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-[#0c0b09]/15 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#faf5ea]/40 before:left-0 before:top-0 border-[#0c0b09]/20 bg-[#faf5ea]/85 text-[#0c0b09] after:from-[#faf5ea]",
  },
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$8,500 Engagement Lead",
    date: "Saturday, 9:30 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] backdrop-blur-none translate-x-12 translate-y-2 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-[#0c0b09]/15 before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-[#faf5ea]/25 before:left-0 before:top-0 border-[#0c0b09]/25 bg-[#faf5ea]/90 text-[#0c0b09] after:from-[#faf5ea]",
  },
  {
    icon: <PhoneCall className="size-4 text-[#faf5ea]" />,
    title: "Missed Opportunity",
    description: "$15,000 Watch Inquiry",
    date: "Yesterday, 11:45 PM",
    iconClassName: "text-[#0c0b09]",
    titleClassName: "text-[#0c0b09]",
    iconWrapperClassName: "bg-[#0c0b09]",
    className:
      "[grid-area:stack] backdrop-blur-none translate-x-24 translate-y-10 border-[#0c0b09]/30 bg-[#faf5ea] text-[#0c0b09] shadow-lg after:from-[#faf5ea]",
  },
];

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [stat] = useState(() => STATS[Math.floor(Math.random() * STATS.length)]);
  const [fade, setFade] = useState(false);
  const [trio] = useState(() => splashTrioLayout(typeof window !== 'undefined' ? window.innerWidth : 390));
  // App passes a fresh arrow function on every render. With [onComplete] as the effect dependency the 2.8 s timer (and the ring
  // preload) were cancelled and restarted on every App re-render (6 restarts in the first 3.3 s: the splash stayed up ~6.8 s instead
  // of ~3.5 s, and the "loop" never settled). Keep the latest callback in a ref and run the timers exactly once.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // The GLB and WebGi runtime stay unloaded until the splash is gone (App schedules them after isReady).
    let done: number | undefined;
    const timer = window.setTimeout(() => {
      setFade(true);
      done = window.setTimeout(() => onCompleteRef.current(), 350);
    }, 900);
    return () => {
      window.clearTimeout(timer);
      if (done) window.clearTimeout(done);
    };
  }, []);

  const skip = () => onCompleteRef.current();

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#faf5ea] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${
        fade ? 'opacity-0' : 'opacity-100'
      }`}
      data-testid="splash"
    >
      <button
        type="button"
        onClick={skip}
        className="absolute right-4 top-4 z-20 rounded-full border border-[#0c0b09]/20 bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0c0b09]"
        data-testid="splash-skip"
      >
        Skip
      </button>
      {/* Soft beige grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(12,11,9,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,11,9,0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      {/* Warm glow: static gradients. The animated SVG turbulence/displacement filter (EtherealShadow) repainted the full screen on
          the main thread every frame and was the biggest single cause of dropped frames here. */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 30% 30%, rgba(200,181,143,0.20), transparent 70%), radial-gradient(ellipse 60% 40% at 75% 62%, rgba(200,181,143,0.14), transparent 70%)',
        }}
      />
      {/* Dots rising from the bottom: pure CSS (a repeating radial-gradient drifting one tile per loop, transform only). The WebGL
          DottedSurface that used to sit here created a WebGL context + shader compile during the entrance (main-thread hitch) and was one
          of the 6 simultaneous contexts on mobile. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 overflow-hidden opacity-70 [mask-image:linear-gradient(to_top,black,transparent)]" aria-hidden>
        <div className="fx-splash-dots absolute inset-x-0 -top-7 bottom-0" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-lg px-4">
        {/* Single prominent wordmark. width/height + aspect-ratio reserve its box before the PNG decodes: without them the flex stack grew ~23 px when the image arrived and the whole centred group (all three cards) jumped ~11 px at ~0.5 s (measured as a 0.07 layout shift). */}
        <div className="fx-splash-in mb-6 md:mb-8" style={{ ['--d' as string]: '0ms' }}>
          <img
            src={fcShad}
            alt="fourcee concierge"
            width={831}
            height={271}
            decoding="async"
            fetchPriority="low"
            className="w-40 sm:w-48 md:w-56 h-auto aspect-[831/271] mx-auto object-contain drop-shadow-sm"
          />
        </div>

        <div className="h-[2px] w-12 bg-[#0c0b09]/35 mx-auto mb-6" />

        {/* Floating missed-opportunity trio: CSS keyframes, transform/opacity only, one shared easing */}
        <div className="relative w-full flex items-center justify-center h-[300px] sm:h-[320px] md:h-[340px] overflow-visible mb-6">
          <div className="relative z-10 origin-center" style={{ scale: String(trio.scale), translate: `${trio.shiftPx}px 0` }} data-testid="splash-trio" data-scale={trio.scale}>
            <div className="fx-splash-float">
              <DisplayCards cards={SPLASH_OPPORTUNITY_CARDS} staggerEntrance />
            </div>
          </div>
        </div>

        <p
          className="fx-splash-in relative z-20 mt-2 max-w-xs rounded-xl bg-[#faf5ea] px-6 py-2 text-center text-sm font-medium text-[#3a342b] uppercase tracking-widest leading-relaxed"
          style={{ ['--d' as string]: '900ms' }}
        >
          {stat}
        </p>
      </div>
    </div>
  );
};
