'use client';

import React, { useEffect, useState } from 'react';

type FaqItem = {
  question: string;
  answer: string;
  meta?: string;
};

type JourneyStep = {
  label: string;
  description: string;
};

interface FaqMonochromeProps {
  isDarkMode: boolean;
  faqs: FaqItem[];
  steps: JourneyStep[];
}

export function FaqMonochrome({ isDarkMode, faqs, steps }: FaqMonochromeProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setHasEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const handleGlowMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--faq-x', `${event.clientX - rect.left}px`);
    target.style.setProperty('--faq-y', `${event.clientY - rect.top}px`);
  };

  const handleGlowLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    target.style.removeProperty('--faq-x');
    target.style.removeProperty('--faq-y');
  };

  return (
    <div
      className={[
        'relative w-full max-w-full min-w-0 overflow-x-clip overflow-y-visible rounded-3xl sm:rounded-[2.5rem] border box-border',
        'px-3 py-5 sm:px-5 sm:py-7 md:px-8 md:py-9',
        'backdrop-blur-2xl transition-colors duration-700',
        isDarkMode
          ? 'bg-navy-950/70 border-white/10 text-white shadow-[0_28px_120px_rgba(0,0,0,0.85)]'
          : 'bg-white/90 border-navy-100 text-navy-950 shadow-[0_28px_80px_rgba(12,11,9,0.22)]',
        'opacity-100 translate-y-0',
      ].join(' ')}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background: isDarkMode
            ? 'radial-gradient(ellipse 120% 140% at 0% 0%, rgba(200,181,143,0.22), transparent 55%)'
            : 'radial-gradient(ellipse 120% 140% at 0% 0%, rgba(12,11,9,0.08), rgba(255,255,255,0.9) 70%)',
          mixBlendMode: isDarkMode ? 'screen' : 'multiply',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-10 md:gap-12">
        {/* Intro pill */}
        <div className="flex justify-center mb-2">
          <div
            className={[
              'relative flex items-center gap-2 sm:gap-3 rounded-full px-3 sm:px-4 py-2 w-full max-w-[min(100%,16rem)] sm:max-w-sm',
              'border text-[10px] font-semibold uppercase tracking-[0.35em]',
              isDarkMode
                ? 'bg-black/60 border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-700',
            ].join(' ')}
          >
            <span className="relative z-10">Signal FAQ</span>
            <span
              className="relative z-10 flex-1 h-px"
              style={{
                background: isDarkMode
                  ? 'linear-gradient(90deg, transparent, rgba(200,181,143,0.8), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(12,11,9,0.6), transparent)',
              }}
            />
            <span
              className={[
                'relative z-10 h-4 w-4 rounded-full border flex items-center justify-center',
                isDarkMode ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-slate-100',
              ].join(' ')}
            >
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  isDarkMode ? 'bg-slate-100' : 'bg-slate-700',
                ].join(' ')}
              />
            </span>
          </div>
        </div>
        {/* Header + Client Journey */}
        <header className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between min-w-0">
          <div className="space-y-3 md:space-y-4 md:max-w-md min-w-0">
            <p
              className={[
                'text-[10px] font-bold uppercase tracking-[0.35em]',
                isDarkMode ? 'text-navy-300' : 'text-navy-500',
              ].join(' ')}
            >
              From package to portal
            </p>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold leading-tight serif tracking-tight break-words">
              What the journey actually looks like once you say &ldquo;yes&rdquo;.
            </h2>
            <p
              className={[
                'text-xs md:text-sm leading-relaxed break-words',
                isDarkMode ? 'text-navy-300' : 'text-navy-600',
              ].join(' ')}
            >
              One lane, no noise: choose a tier, we build and test with you, then hand you a live analytics view of
              every call and Nivoda-backed search.
            </p>
          </div>

          <div className="md:max-w-sm w-full min-w-0">
            <div className="rounded-[1.75rem] bg-white/90 dark:bg-white/5 border border-white/40 dark:border-white/20 px-3 sm:px-4 py-4 shadow-sm w-full min-w-0 max-w-full overflow-x-hidden overflow-y-visible">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-navy-400 dark:text-navy-300">
                  Client journey
                </span>
                <span className="h-1.5 w-16 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 opacity-80" />
              </div>
              <div id="faq-journey-track" className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.label}
                    className={[
                      'min-w-0 rounded-2xl border px-3 py-2.5 text-left shadow-sm',
                      'bg-white dark:bg-white/5',
                      idx === 0
                        ? 'border-navy-900/70 dark:border-white/70'
                        : 'border-navy-100/70 dark:border-white/10',
                    ].join(' ')}
                  >
                    <p className="text-[11px] font-semibold normal-case tracking-normal text-navy-800 dark:text-navy-100">
                      {step.label}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-navy-600 dark:text-navy-100">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* FAQ List */}
        <section className="space-y-4">
          <p
            className={[
              'text-[10px] font-bold uppercase tracking-[0.35em] break-words',
              isDarkMode ? 'text-emerald-300' : 'text-navy-500',
            ].join(' ')}
          >
            Designed for the boardroom - the questions your CFO will ask
          </p>
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            {faqs.map((item, index) => {
              const open = activeIndex === index;
              return (
                <div
                  key={item.question}
                  className={[
                    'relative overflow-visible rounded-2xl border px-3 py-3 sm:px-4 sm:py-4 text-left transition-all duration-300 cursor-pointer group',
                    isDarkMode
                      ? 'border-white/12 bg-white/0 hover:bg-white/5'
                      : 'border-navy-100 bg-white/60 hover:bg-white',
                    open ? 'ring-1 ring-emerald-400/80 shadow-lg' : '',
                  ].join(' ')}
                  onClick={() => setActiveIndex(open ? -1 : index)}
                  onMouseMove={handleGlowMove}
                  onMouseLeave={handleGlowLeave}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: `radial-gradient(200px circle at var(--faq-x, 50%) var(--faq-y, 50%), ${
                        isDarkMode ? 'rgba(96,165,250,0.18)' : 'rgba(12,11,9,0.08)'
                      }, transparent 70%)`,
                    }}
                  />
                  <div className="relative flex items-start gap-3">
                    <span
                      className={[
                        'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold',
                        isDarkMode
                          ? 'border-white/30 text-white bg-white/5'
                          : 'border-slate-300 text-slate-800 bg-white',
                      ].join(' ')}
                    >
                      {open ? '×' : '+'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm md:text-[15px] font-semibold leading-snug break-words">{item.question}</p>
                        {item.meta && (
                          <span
                            className={[
                              'inline-flex max-w-full shrink-0 items-center whitespace-normal break-words rounded-full border px-2.5 py-1 text-[10px] font-semibold normal-case tracking-normal',
                              isDarkMode
                                ? 'border-white/20 text-slate-200 bg-white/5'
                                : 'border-slate-200 text-slate-700 bg-white/80',
                            ].join(' ')}
                          >
                            {item.meta}
                          </span>
                        )}
                      </div>
                      <div
                        className={[
                          'mt-2 text-xs md:text-sm leading-relaxed transition-[max-height,opacity] duration-300',
                          open ? 'max-h-[40rem] opacity-100 overflow-y-visible' : 'max-h-0 opacity-0 overflow-hidden',
                          isDarkMode ? 'text-navy-200' : 'text-navy-600',
                        ].join(' ')}
                      >
                        <p className="break-words">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

