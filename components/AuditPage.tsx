import React, { useEffect, useState } from 'react';
import { assetUrl } from '../lib/asset-url';
import { AuditLeadGate } from './AuditLeadGate';
import { loadAuditContent } from '../lib/audit-content';
import { loadAuditGateBrief, type AuditGateBrief } from '../lib/audit-gate-brief';
import { takeSealedAudit } from '../lib/audit-sealed';
import { configuredCalUrl, demoDurationLine, isPlaceholderReportId, visitAuditDate } from '../lib/prospect-fixes';
import fcWhite from '../public/assets/fcwhite.png';
import fcBlack from '../public/assets/fcblack.png';
import placeholderGif from '../public/assets/placeholder.gif';
import { PendantFBX } from './PendantFBX';
import { MiniPhone } from './ui/mini-phone';
import { IncomingCallPhone } from './ui/incoming-call-phone';
import { ValueCalculator } from './ValueCalculator';
import type { AuditData } from '../types/audit';
import {
  formatAuditCurrency,
  formatAuditRange,
  resolveBusinessLogo,
  resolveHeroImage,
} from '../lib/audit-content';
import {
  BeforeAfterCards,
  CallVolumeBarChart,
  GbpSnapshotMockup,
  MissedCallDonutChart,
  RevenueLeakLineChart,
  SectionTrustFooter,
  TrafficPieChart,
} from './AuditCharts';

interface AuditPageProps {
  isDarkMode: boolean;
  onGetLive: () => void;
  onBookCall: () => void;
  /** Showroom name/city already read for the long page. Omit on a direct #/audit visit so the report file is not fetched yet. */
  brief?: AuditGateBrief | null;
}

/** `surface`: navy = light page header (blue bar); white = dark page header (white bar). */
const HeaderMetaItem: React.FC<{ label: string; tone?: 'gold' | 'silver'; surface: 'navy' | 'white' }> = ({
  label,
  tone = 'silver',
  surface,
}) => {
  const onNavy = surface === 'navy';
  if (tone === 'gold') {
    const cls = onNavy
      ? 'rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)]'
      : 'rounded-full border border-amber-200/80 bg-gradient-to-r from-amber-50 to-white px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-950 shadow-[0_8px_20px_rgba(12,11,9,0.06)]';
    return <span className={cls}>{label}</span>;
  }
  const cls = onNavy
    ? 'rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100'
    : 'rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-800 shadow-[0_8px_20px_rgba(12,11,9,0.06)]';
  return <span className={cls}>{label}</span>;
};

const HeroMetricPill: React.FC<{ label: string; value: string; isDarkMode: boolean }> = ({ label, value, isDarkMode }) => (
  <div className={`rounded-2xl border px-4 py-3 backdrop-blur-md ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'border-navy-200 bg-white/80'}`}>
    <p className={`text-[10px] uppercase tracking-[0.22em] ${isDarkMode ? 'text-slate-400' : 'text-navy-500'}`}>{label}</p>
    <p className={`mt-2 text-xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{value}</p>
  </div>
);

/** Sits just above the dock, and only after the first stats row has scrolled off, so it does not cover that card. */
const RecoverDock: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
  const [clear, setClear] = useState(false);
  useEffect(() => {
    const el = document.getElementById('audit-hero-metrics');
    if (!el || typeof IntersectionObserver === 'undefined') {
      setClear(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setClear(!entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (!clear) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 md:hidden"
      style={{ bottom: 'calc(var(--nav-dock-bottom, 1rem) + var(--nav-dock-height, 3.5rem) + 0.75rem)' }}
    >
      <button type="button" onClick={onClick} className="pointer-events-auto fx-btn fx-btn-primary max-w-[calc(100vw-2rem)] shadow-lg">
        {label}
      </button>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: string; isDarkMode: boolean }> = ({ title, value, isDarkMode }) => (
  <div className={`group rounded-3xl border p-6 transition hover:-translate-y-0.5 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950/80 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-amber-500/20' : 'border-navy-200 bg-white/85 shadow-[0_10px_28px_rgba(12,11,9,0.06)] hover:border-navy-300'}`}>
    <p className={`text-[10px] uppercase tracking-[0.24em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>{title}</p>
    <p className={`mt-3 text-3xl font-semibold transition ${isDarkMode ? 'text-slate-100 group-hover:text-amber-100' : 'text-navy-900 group-hover:text-emerald-800'}`}>{value}</p>
  </div>
);

const ProgressMetric: React.FC<{ label: string; value: string; widthClass: string; isDarkMode: boolean }> = ({
  label,
  value,
  widthClass,
  isDarkMode,
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>{label}</span>
      <span className={`shrink-0 text-right text-base font-semibold tabular-nums ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{value}</span>
    </div>
    <div className={`h-3.5 rounded-full border p-0.5 ${isDarkMode ? 'border-white/10 bg-gradient-to-b from-zinc-900 to-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.65)]' : 'border-navy-200 bg-[#f3ebe0]'}`}>
      <div
        className={`h-full min-h-[10px] rounded-full ${
          isDarkMode
            ? 'bg-gradient-to-r from-slate-400 via-amber-300 to-yellow-500 shadow-[0_0_16px_rgba(212,175,55,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]'
            : 'bg-gradient-to-r from-slate-500 via-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]'
        } ${widthClass}`}
      />
    </div>
  </div>
);

const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const gridBgStyle: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

const gridBgStyleLight: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(12,11,9,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(12,11,9,0.06) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

export const AuditPage: React.FC<AuditPageProps> = ({ isDarkMode, onGetLive, onBookCall, brief: briefProp }) => {
  // The report tree is not created until a sent lead. A refresh shows the gate again.
  const [brief, setBrief] = useState<AuditGateBrief | null>(briefProp ?? null);
  const [report, setReport] = useState<AuditData | null>(null);
  const [gateError, setGateError] = useState(false);
  const [showHeaderStats, setShowHeaderStats] = useState(false);

  useEffect(() => {
    if (briefProp) setBrief(briefProp);
  }, [briefProp]);

  useEffect(() => {
    if (briefProp || brief) return;
    let live = true;
    loadAuditGateBrief()
      .then((next) => { if (live) setBrief(next); })
      .catch(() => { if (live) setGateError(true); });
    return () => { live = false; };
  }, [briefProp, brief]);

  const unlock = () => {
    const sealed = takeSealedAudit();
    const pending = sealed ? Promise.resolve(sealed) : loadAuditContent();
    void pending.then((full) => setReport(full)).catch(() => setGateError(true));
  };

  if (!report) {
    return (
      <div className={`relative min-h-screen dock-safe-pad ${isDarkMode ? 'text-white' : 'text-navy-900'} font-sans`}>
        {brief ? (
          <AuditLeadGate brief={brief} isDarkMode={isDarkMode} onUnlocked={unlock} />
        ) : gateError ? (
          <p className="px-6 pt-24 text-center text-navy-700">The showroom brief could not be loaded.</p>
        ) : (
          <p className="px-6 pt-24 text-center text-navy-700">Loading audit…</p>
        )}
      </div>
    );
  }

  const data = report;
  const headerSurface = 'navy';
  const triggerBooking = () => {
    scrollToId('audit-booking-cta');
    onBookCall();
  };
  const generatedDate = visitAuditDate(data.auditMeta.generatedDate);
  const reportId = isPlaceholderReportId(data.auditMeta.reportId) ? '' : data.auditMeta.reportId;
  const businessLogo = resolveBusinessLogo(data);
  const businessHeroImage = resolveHeroImage(data);
  const liveDemo = data.liveDemo;
  const durationLine = demoDurationLine(liveDemo.helperCopy, liveDemo.demoDurationHint);
  const calUrl = configuredCalUrl();
  const formatCurrency = (amount: number) => formatAuditCurrency(data, amount);
  const formatRange = formatAuditRange;
  const shellClass = isDarkMode
    ? 'border-white/10 bg-gradient-to-br from-navy-900/90 via-navy-950 to-navy-900/90 text-white'
    : 'border-navy-200/80 bg-gradient-to-br from-[#faf5ea] via-[#f6efdf] to-[#f2e8d2] text-navy-900 shadow-[0_18px_55px_rgba(12,11,9,0.08)]';
  const panelClass = isDarkMode
    ? 'border-white/10 bg-white/[0.04] text-white'
    : 'border-navy-200/80 bg-white/85 text-navy-900 shadow-[0_10px_35px_rgba(12,11,9,0.06)]';

  return (
    <div
      className={`relative min-h-screen dock-safe-pad pb-28 sm:pb-32 ${
        isDarkMode
          ? 'text-white [background:radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(212,175,55,0.07),transparent_55%),linear-gradient(180deg,#050504_0%,#0d0d0d_45%,#0c0b09_100%)]'
          : 'text-navy-900 [background:radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(188,146,72,0.16),transparent_58%),linear-gradient(180deg,#faf5ea_0%,#f6efdf_50%,#f2e8d2_100%)]'
      } font-sans`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${isDarkMode ? 'opacity-[0.22]' : 'opacity-[0.34]'}`}
        style={{
          ...(isDarkMode ? gridBgStyle : gridBgStyleLight),
          maskImage: 'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
        }}
      />


      <div className="relative z-30 px-3 pt-2 md:sticky md:top-2 md:px-4">
        <div
          className={`relative mx-auto w-full rounded-2xl border shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:w-[min(1120px,94vw)] ${
            isDarkMode
              ? 'border-[rgba(200,181,143,0.28)] bg-[rgba(8,18,28,0.92)] text-[#f3ebe0]'
              : 'border-navy-700/70 bg-[#0a0a0a]/92 text-white'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={isDarkMode ? gridBgStyleLight : gridBgStyle} />
          <div className="relative z-10 mx-auto flex w-full flex-col gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setShowHeaderStats((prev) => !prev)}
              className="w-full rounded-2xl p-1 text-left transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              aria-expanded={showHeaderStats}
              aria-label="Toggle audit summary stats"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={businessLogo}
                    alt={`${data.business.name} logo`}
                    className={`h-11 w-11 shrink-0 rounded-xl object-cover ring-2 shadow-md ${
                      isDarkMode ? 'ring-navy-200' : 'ring-white/30'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="fx-kicker">
                      Audit prepared for
                    </p>
                    <p className={`truncate text-base font-semibold tracking-tight md:text-lg ${isDarkMode ? 'text-[#f4efe4]' : 'text-white'}`}>
                      {data.business.name}
                    </p>
                    <p className={`truncate text-xs ${isDarkMode ? 'text-[#a8957a]' : 'text-slate-300'}`}>{data.business.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-start gap-2 text-left sm:items-end sm:text-right">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.25em] ${isDarkMode ? 'text-[#a8957a]' : 'text-slate-400'}`}>Intelligence by</p>
                    <img
                      src={fcWhite}
                      alt="Fourcee"
                      className="h-8 w-auto object-contain opacity-95 sm:h-9 md:h-10"
                    />
                  </div>
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                      isDarkMode ? 'border-white/25 text-[#f3ebe0]' : 'border-white/30 text-white'
                    }`}
                    aria-hidden
                  >
                    <svg className={`h-4 w-4 transition-transform ${showHeaderStats ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor">
                      <path d="M5 7.5L10 12.5L15 7.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>
            </button>
            {showHeaderStats && (
              <div className="flex flex-wrap items-center gap-2">
                <HeaderMetaItem
                  tone="gold"
                  surface={headerSurface}
                  label={`${data.reviews.starsDisplay} ${data.reviews.rating.toFixed(1)} • ${data.reviews.count.toLocaleString()} Google Reviews`}
                />
                <HeaderMetaItem
                  tone="silver"
                  surface={headerSurface}
                  label={`Answer Rate ${formatRange(data.callModel.answerRateMin, data.callModel.answerRateMax)}%`}
                />
                <HeaderMetaItem
                  tone="gold"
                  surface={headerSurface}
                  label={`Missed Calls ${formatRange(data.callModel.missedCallsPerWeekMin, data.callModel.missedCallsPerWeekMax)}/week`}
                />
                {generatedDate ? (
                  <HeaderMetaItem tone="silver" surface={headerSurface} label={`Generated ${generatedDate}`} />
                ) : null}
                {reportId ? (
                  <HeaderMetaItem tone="gold" surface={headerSurface} label={`Report ${reportId}`} />
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`mx-auto w-full max-w-7xl px-4 md:px-8 ${
          'pt-4 pb-8'
        }`}
      >
        {/* Hero: Fourcee mark + copy + MiniPhone + 3D ring — business image via content.json injection */}
        <section
          className={`relative isolate overflow-hidden rounded-[2rem] border p-6 md:p-10 ${
            isDarkMode
              ? 'border-white/10 bg-[#0c0b09] text-white'
              : 'border-navy-200/80 bg-[#faf5ea] text-navy-900 shadow-[0_18px_55px_rgba(12,11,9,0.08)]'
          }`}
        >
          {isDarkMode && (
            <div
              className="pointer-events-none absolute inset-0 opacity-35 mix-blend-soft-light"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.18) 0.6px, transparent 0.6px), radial-gradient(rgba(255,255,255,0.1) 0.6px, transparent 0.6px)',
                backgroundSize: '3px 3px, 5px 5px',
                backgroundPosition: '0 0, 1px 2px',
              }}
            />
          )}
          <div className="relative z-10 mb-6 flex justify-center md:mb-8">
            <img
              src={isDarkMode ? fcWhite : fcBlack}
              alt="Fourcee"
              className="h-10 w-auto object-contain opacity-95 sm:h-12 md:h-14"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 z-[1] opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>Prepared exclusively for:</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <img
                  src={businessLogo}
                  alt=""
                  className="hidden h-12 w-12 rounded-xl object-cover ring-1 ring-white/15 sm:block"
                  aria-hidden
                />
                <div>
                  <h1 className={`text-2xl font-semibold leading-tight md:text-3xl ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
                    Phone Performance Audit Report
                  </h1>
                  <p className={`mt-2 text-lg ${isDarkMode ? 'text-slate-200' : 'text-navy-700'}`}>
                    {data.business.name} - {data.business.location}
                  </p>
                </div>
              </div>

              <p className={`mt-4 max-w-2xl text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>
                Fourcee is the voice AI built for high-end jewelers: it answers and qualifies serious callers and
                passes them to your team. This page shows your current phone leakage and lets you hear how
                Fourcee responds before you commit.
              </p>

              <div id="audit-hero-metrics" className="mt-7 grid gap-3 sm:grid-cols-3">
                <HeroMetricPill label="Inbound Calls / Week" value={formatRange(data.callModel.inboundCallsPerWeekMin, data.callModel.inboundCallsPerWeekMax)} isDarkMode={isDarkMode} />
                <HeroMetricPill label="Typical Answer Rate" value={`${formatRange(data.callModel.answerRateMin, data.callModel.answerRateMax)}%`} isDarkMode={isDarkMode} />
                <HeroMetricPill label="Likely Missed / Week" value={`${formatRange(data.callModel.missedCallsPerWeekMin, data.callModel.missedCallsPerWeekMax)} calls`} isDarkMode={isDarkMode} />
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button type="button" onClick={onGetLive} className="fx-btn fx-btn-primary">
                  Get live within days
                </button>
                <button type="button" onClick={() => scrollToId('audit-lost-revenue')} className="fx-btn fx-btn-ghost">
                  See the proof
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-8 lg:max-w-[min(100%,440px)] lg:justify-self-end">
              {businessHeroImage ? (
                <img
                  src={businessHeroImage}
                  alt=""
                  className="mx-auto max-h-56 w-full rounded-[1.75rem] object-contain [mask-image:radial-gradient(ellipse_at_center,black_62%,transparent_92%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_62%,transparent_92%)]"
                />
              ) : null}
              <div className={`relative isolate flex min-h-[200px] w-full items-center justify-center overflow-visible rounded-2xl border sm:min-h-[260px] md:min-h-[300px] ${isDarkMode ? 'border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent' : 'border-navy-200 bg-gradient-to-b from-white to-slate-100'}`}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,rgba(212,175,55,0.14),transparent_55%)]" />
                <div className="pointer-events-none absolute bottom-6 left-1/2 h-14 w-44 -translate-x-1/2 rounded-[100%] bg-white/10 blur-2xl" />
                <PendantFBX
                  className="relative z-0 mx-auto h-[min(48vw,200px)] w-full max-w-[min(100%,280px)] sm:h-[240px] sm:max-w-[320px] md:h-[280px] md:max-w-[360px]"
                  isDarkMode={isDarkMode}
                />
              </div>
              <div id="audit-live-test" className="relative z-20 scroll-mt-28 w-full max-w-md shrink-0 self-center rounded-2xl bg-[#faf5ea] p-3 shadow-[0_12px_40px_rgba(12,11,9,0.12)]">
                <p
                  className={`mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.28em] ${isDarkMode ? 'text-amber-200/85' : 'text-navy-700'}`}
                >
                  {liveDemo.ctaLabel}
                </p>
                <MiniPhone
                  isDarkMode={isDarkMode}
                  className="w-full"
                  businessName={data.business.name}
                  leadId={data.lead_id}
                  phoneCountryDefault={liveDemo.phoneCountryDefault}
                  ctaLabel={liveDemo.ctaLabel}
                  helperCopy={durationLine}
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="audit-lost-revenue"
          className="relative z-0 mt-12 min-h-0 overflow-hidden rounded-[2rem] border border-[rgba(200,181,143,0.22)] bg-[#050504] px-5 py-8 pb-16 md:px-10 md:py-10"
        >
          <div className="fx-grid opacity-80" aria-hidden />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="fx-tile px-4 py-3">
              <p className="fx-kicker">Audit prepared for</p>
              <p className="mt-1 text-sm text-[#f4efe4]">
                {data.business.name} · {data.business.location}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {generatedDate ? <span className="fx-chip">Generated {generatedDate}</span> : null}
              {reportId ? <span className="fx-chip">Report {reportId}</span> : null}
            </div>
          </div>
          <div className="relative z-10 mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="fx-kicker">Lost revenue proof</p>
              <h2 className="fx-display mt-3 text-4xl leading-[0.95] text-[#f4efe4] md:text-5xl">
                {formatCurrency(data.revenueModel.monthlyLossMin)}–{formatCurrency(data.revenueModel.monthlyLossMax)}
              </h2>
              <p className="mt-3 text-base md:text-lg" style={{ color: 'var(--fourcee-accent-copper)' }}>
                walks out every month unanswered.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#a8957a]">
                Mid-range leak for {data.business.name}: {formatCurrency(data.revenueModel.monthlyLossMidpoint)} / month.
                Six-month cumulative: {formatCurrency(data.revenueModel.sixMonthCumulativeLeak)}.
                {data.compliance.disclaimerShort ? ` ${data.compliance.disclaimerShort}` : ''}
              </p>
              <div className="mt-7 grid grid-cols-3 gap-2 sm:max-w-lg sm:gap-3">
                <HeroMetricPill
                  label="Inbound / week"
                  value={formatRange(data.callModel.inboundCallsPerWeekMin, data.callModel.inboundCallsPerWeekMax)}
                  isDarkMode
                />
                <HeroMetricPill
                  label="Answer rate"
                  value={`${formatRange(data.callModel.answerRateMin, data.callModel.answerRateMax)}%`}
                  isDarkMode
                />
                <HeroMetricPill
                  label="Missed / week"
                  value={formatRange(data.callModel.missedCallsPerWeekMin, data.callModel.missedCallsPerWeekMax)}
                  isDarkMode
                />
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={onGetLive} className="fx-btn fx-btn-primary">
                  Recover this revenue
                </button>
                <button type="button" onClick={() => scrollToId('audit-full-report')} className="fx-btn fx-btn-ghost">
                  See the proof
                </button>
              </div>
            </div>
            <div className="relative min-h-[320px] sm:min-h-[420px]">
              <img
                src={assetUrl('assets/plates/plate_missed_call_phone.png')}
                alt=""
                className="pointer-events-none mx-auto h-[min(58vh,520px)] w-auto max-w-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
                aria-hidden
              />
              <div className="fx-tile absolute bottom-2 right-0 w-[min(100%,300px)] p-4 sm:bottom-6 sm:right-4">
                <p className="fx-kicker">After-hours inquiry</p>
                <p className="mt-3 text-sm text-[#f2d4d0]">Missed · Sunday 8:14 PM</p>
                <p className="mt-1 text-xl text-[#f4efe4]">$12,000 anniversary band</p>
                <p className="mt-2 text-sm leading-relaxed text-[#a8957a]">
                  Caller did not wait. Next jeweler is already in the recents list.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ROI calculator moved directly below hero */}
        <section className="mt-8">
          <p className={`mb-4 text-[10px] uppercase tracking-[0.28em] ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Model your own numbers</p>
          <ValueCalculator isDarkMode={isDarkMode} businessName={data.business.name} />
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={onGetLive} className="fx-btn fx-btn-primary">
              Launch concierge now
            </button>
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Executive Summary + demo gif */}
        <section className={`mt-8 overflow-hidden rounded-[2rem] border p-6 md:p-8 ${shellClass}`}>
          <p className={`text-[10px] uppercase tracking-[0.27em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>Executive Summary</p>
          <p className={`mt-3 max-w-4xl text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>
            This is a live audit + test environment: review where calls are being lost, then trigger a real demo flow
            to see how Fourcee captures demand and routes buyers to your team.
          </p>
          <div className={`mt-6 flex min-h-[12rem] justify-center overflow-hidden rounded-2xl border shadow-2xl md:min-h-[14rem] ${isDarkMode ? 'border-white/10 bg-navy-950/50' : 'border-navy-200 bg-white/80'}`}>
            <img
              src={placeholderGif}
              alt="Call intelligence preview"
              className="max-h-56 w-auto max-w-full object-contain object-center md:max-h-64"
            />
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Methodology */}
        <section className={`mt-8 rounded-[2rem] border p-6 md:p-8 ${panelClass}`}>
          <p className={`text-[10px] uppercase tracking-[0.27em] ${isDarkMode ? 'text-white/60' : 'text-navy-500'}`}>Research Methodology</p>
          <p className={`mt-3 max-w-4xl text-sm leading-relaxed ${isDarkMode ? 'text-white/85' : 'text-navy-700'}`}>
            This report is based on your Google Business Profile performance ({data.reviews.count} reviews), website traffic patterns
            for {data.business.industry} businesses, local search behavior in your area, and industry benchmarks.
          </p>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Key findings + revenue impact + vibrating phone */}
        <section className="mt-8">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Key Findings</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <KpiCard title="Estimated Inbound Calls" value={`${formatRange(data.callModel.inboundCallsPerWeekMin, data.callModel.inboundCallsPerWeekMax)} per week`} isDarkMode={isDarkMode} />
            <KpiCard title="Typical Answer Rate" value={`${formatRange(data.callModel.answerRateMin, data.callModel.answerRateMax)}%`} isDarkMode={isDarkMode} />
            <KpiCard title="Likely Missed Calls" value={`${formatRange(data.callModel.missedCallsPerWeekMin, data.callModel.missedCallsPerWeekMax)} per week`} isDarkMode={isDarkMode} />
          </div>
          <div className={`mt-8 flex flex-col gap-8 rounded-[2rem] border p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-10 ${shellClass}`}>
            <div className="text-center lg:max-w-xl lg:text-left">
              <p className={`text-[10px] uppercase tracking-[0.28em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>Revenue Impact</p>
              <p className={`mt-3 text-2xl font-semibold leading-tight lg:text-4xl ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
                Estimated Monthly Lost Revenue: {formatCurrency(data.revenueModel.monthlyLossMin)} - {formatCurrency(data.revenueModel.monthlyLossMax)}
              </p>
              <p className={`mt-2 text-sm ${isDarkMode ? 'text-slate-500' : 'text-navy-600'}`}>~{formatCurrency(data.revenueModel.monthlyLossMidpoint)} / month at typical mid-range assumptions</p>
            </div>
            <div className="mx-auto w-full max-w-sm shrink-0 lg:mx-0 lg:max-w-md">
              <IncomingCallPhone isDarkMode={isDarkMode} className="w-full" onAction={triggerBooking} />
            </div>
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Charts: bar → donut → line */}
        <div id="audit-full-report" className="mt-10 scroll-mt-28 space-y-8">
          <CallVolumeBarChart callModel={data.callModel} isDarkMode={isDarkMode} />
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
          <div className="grid gap-8 lg:grid-cols-2">
            <MissedCallDonutChart missedCallTypeSplit={data.callModel.missedCallTypeSplit} isDarkMode={isDarkMode} />
            <RevenueLeakLineChart lineSeries={data.revenueModel.lineSeries} currencySymbol={data.auditMeta.currencySymbol} cumulativeLeak={data.revenueModel.sixMonthCumulativeLeak} isDarkMode={isDarkMode} />
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </div>

        {/* Table */}
        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Missed Calls Breakdown</h2>
            <div
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                isDarkMode
                  ? 'border-red-400/35 bg-red-950/30 text-red-100'
                  : 'border-red-300 bg-red-100 text-red-900'
              }`}
            >
              {data.breakdown.riskBadge}
            </div>
          </div>
          <div className={`mt-4 overflow-hidden rounded-3xl border ${isDarkMode ? 'border-white/10' : 'border-navy-200'}`}>
            <table className="w-full">
              <thead className={`text-left ${isDarkMode ? 'bg-white/[0.04]' : 'bg-[#f3ebe0]'}`}>
                <tr className={`text-[10px] uppercase tracking-[0.24em] ${isDarkMode ? 'text-white/60' : 'text-navy-500'}`}>
                  <th className="px-5 py-4">Call Type</th>
                  <th className="px-5 py-4">Est. Missed / Week</th>
                  <th className="px-5 py-4">Monthly Revenue Impact</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.rows.map((row) => (
                  <tr
                    key={row.callType}
                    className={`border-t transition hover:translate-x-[2px] ${isDarkMode ? 'border-white/10 hover:bg-white/[0.06]' : 'border-navy-100 hover:bg-slate-50'}`}
                  >
                    <td className={`px-5 py-4 text-sm ${isDarkMode ? 'text-white/90' : 'text-navy-800'}`}>{row.callType}</td>
                    <td className={`px-5 py-4 text-sm ${isDarkMode ? 'text-white/80' : 'text-navy-700'}`}>{formatRange(row.weeklyMissedMin, row.weeklyMissedMax)}</td>
                    <td className="px-5 py-4 text-sm font-medium">
                      <span className={isDarkMode ? 'text-amber-100' : 'font-semibold text-emerald-900'}>
                        {formatCurrency(row.monthlyImpactMin)} - {formatCurrency(row.monthlyImpactMax)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`mt-6 rounded-3xl border p-4 md:p-6 ${shellClass}`}>
            <div className="grid gap-4 md:gap-5">
              {data.breakdown.opportunityCards.map((card) => (
                <div key={card.title} className="grid w-full items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_168px]">
                  <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/15 bg-white/[0.04] text-slate-100' : 'border-navy-200 bg-white/85 text-navy-900'}`}>
                    <p className="text-base font-semibold tracking-tight">{card.title}</p>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>{card.subtitle}</p>
                    <p className={`mt-2 text-sm font-medium ${isDarkMode ? 'text-amber-200' : 'text-navy-800'}`}>{card.valueNote}</p>
                  </div>
                  <div className={`rounded-2xl border p-4 text-center ${isDarkMode ? 'border-navy-700 bg-navy-900/70 text-slate-100' : 'border-navy-200 bg-navy-900 text-white'}`}>
                    <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-navy-200' : 'text-white/80'}`}>Monthly impact</p>
                    <p className="mt-2 text-2xl font-bold">{card.impactTier}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className={`mt-5 text-center text-sm ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>
              Every missed call is a missed opportunity - the cost adds up across all categories.
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-navy-200 bg-white/80'}`}>
              <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>Most exposed segment</p>
              <p className={`mt-2 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{data.breakdown.rows[0]?.callType || 'High-value inquiries'}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/[0.02]' : 'border-navy-200 bg-white/80'}`}>
              <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>Immediate monthly leak</p>
              <p className={`mt-2 text-sm font-semibold ${isDarkMode ? 'text-amber-100' : 'text-emerald-900'}`}>
                {formatCurrency(data.revenueModel.monthlyLossMin)} - {formatCurrency(data.revenueModel.monthlyLossMax)}
              </p>
            </div>
            <div
              className={`rounded-2xl border p-4 ${isDarkMode ? 'border-amber-400/25 bg-amber-950/20' : 'border-amber-200/80 bg-amber-50'}`}
            >
              <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-amber-200/80' : 'text-amber-900'}`}>Decision pressure</p>
              <p className={`mt-2 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Each missed call compounds every week.</p>
            </div>
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        <section className={`mt-10 rounded-[2rem] border p-6 md:p-8 ${panelClass}`}>
          <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>What This Means For Your Business</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className={`rounded-2xl border p-5 ${isDarkMode ? 'border-white/10 bg-navy-950/40' : 'border-navy-200 bg-white/80'}`}>
              <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-white/85' : 'text-navy-700'}`}>
                You are currently losing between{' '}
                <span className={`font-semibold ${isDarkMode ? 'text-amber-100' : 'text-emerald-900'}`}>
                  {formatCurrency(data.revenueModel.monthlyLossMin)} and {formatCurrency(data.revenueModel.monthlyLossMax)}
                </span>{' '}
                every month simply because calls are going unanswered. Most of these callers do not call back.
              </p>
            </div>
            <div
              className={`rounded-2xl border p-5 ${
                isDarkMode ? 'border-red-400/30 bg-red-950/25' : 'border-red-200 bg-red-50'
              }`}
            >
              <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-red-100' : 'text-red-900'}`}>
                Behavioral reality
              </p>
              <p className={`mt-2 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
                Buyers call the next jeweller within minutes.
              </p>
            </div>
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Proof: GBP + traffic + before/after */}
        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <GbpSnapshotMockup reviews={data.reviews} isDarkMode={isDarkMode} />
          <TrafficPieChart trafficSources={data.traffic.sources} isDarkMode={isDarkMode} />
        </section>
        <div className="mt-8">
          <BeforeAfterCards comparison={data.comparison} currencySymbol={data.auditMeta.currencySymbol} isDarkMode={isDarkMode} />
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </div>

        <section className={`mt-10 rounded-[2rem] border p-6 md:p-8 ${panelClass}`}>
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Projected Results Within 90 Days</h2>
          <div className="mt-5 space-y-5">
            <ProgressMetric label="Answer rate" value={data.projection90d.answerRateProjected} widthClass={data.projection90d.barWidths.answerRate} isDarkMode={isDarkMode} />
            <ProgressMetric label="Monthly revenue recovered" value={data.projection90d.monthlyRecoveredProjected} widthClass={data.projection90d.barWidths.monthlyRecovered} isDarkMode={isDarkMode} />
            <ProgressMetric label="Typical payback period" value={data.projection90d.paybackPeriodProjected} widthClass={data.projection90d.barWidths.paybackPeriod} isDarkMode={isDarkMode} />
          </div>
          <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
        </section>

        {/* Recovery plan + Nivoda gif */}
        <section className={`mt-10 overflow-hidden rounded-[2rem] border md:grid md:grid-cols-[1fr_minmax(0,380px)] md:gap-0 ${panelClass}`}>
          <div className="p-6 md:p-8">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{data.recoveryPlan.headline}</h2>
            <p className={`mt-3 max-w-2xl text-sm leading-relaxed ${isDarkMode ? 'text-white/75' : 'text-navy-700'}`}>
              {data.recoveryPlan.body ||
                `Recovering this pipeline starts with immediate coverage and fast lead handling. Based on your current model, this is a practical rollout designed to recover ${formatCurrency(data.revenueModel.monthlyLossMin)} to ${formatCurrency(data.revenueModel.monthlyLossMax)} in monthly leakage while protecting showroom experience.`}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-navy-200 bg-white/80'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-amber-300' : 'text-navy-600'}`}>Week 1</p>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-200' : 'text-navy-800'}`}>We set up call answering and your handoff rules with you.</p>
              </div>
              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-navy-200 bg-white/80'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-amber-300' : 'text-navy-600'}`}>Week 2</p>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-200' : 'text-navy-800'}`}>Enable qualification + appointment booking workflows.</p>
              </div>
              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-navy-200 bg-white/80'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-amber-300' : 'text-navy-600'}`}>Week 3</p>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-200' : 'text-navy-800'}`}>Sync transcripts and lead outcomes into your CRM.</p>
              </div>
              <div className={`rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-navy-200 bg-white/80'}`}>
                <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-amber-300' : 'text-navy-600'}`}>Week 4+</p>
                <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-200' : 'text-navy-800'}`}>Optimize conversion scripts using real call analytics.</p>
              </div>
            </div>
            <ul className={`mt-4 space-y-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-navy-700'}`}>
              {data.recoveryPlan.capabilities.map((capability) => (
                <li key={capability} className="flex items-center gap-2">
                  <span className={isDarkMode ? 'text-amber-300' : 'text-emerald-700'}>•</span>
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
            <SectionTrustFooter dataSourceLine={data.compliance.dataSourceLine} isDarkMode={isDarkMode} />
          </div>
          <div className={`border-t md:border-l md:border-t-0 ${isDarkMode ? 'border-white/10 bg-navy-950/50' : 'border-navy-200 bg-[#f3ebe0]/60'}`}>
            <img src={data.recoveryPlan.supportingMediaUrl} alt="Live inventory intelligence" className="h-full min-h-[200px] w-full object-cover" />
          </div>
        </section>

        <section className={`relative mt-10 overflow-hidden rounded-[2rem] border px-6 py-10 text-center md:px-12 md:py-12 ${shellClass}`}>
          <div className="pointer-events-none absolute inset-0 opacity-20" style={isDarkMode ? gridBgStyle : gridBgStyleLight} />
          <p className={`relative mx-auto max-w-3xl text-lg font-semibold leading-snug md:text-2xl md:leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
            A serious buyer reaching out to their preferred jeweller should never be lost because no one could answer
            the phone.{' '}
            <span className={isDarkMode ? 'text-amber-200' : 'font-semibold text-emerald-800'}>That changes with Fourcee.</span>
          </p>
          <p className={`relative mx-auto mt-4 max-w-2xl text-xs uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>
            Every qualified caller gets answered, routed, and captured.
          </p>
        </section>

        <section
          id="audit-booking-cta"
          className={`mt-10 rounded-[2rem] border p-8 text-center ${
            isDarkMode
              ? 'border-amber-500/20 bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]'
              : 'border-navy-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-[0_14px_35px_rgba(12,11,9,0.08)]'
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.3em] ${isDarkMode ? 'text-amber-200/80' : 'text-navy-600'}`}>Choose Your Next Step</p>
          <h2 className={`mt-3 text-2xl font-semibold md:text-4xl ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
            You are currently losing between {formatCurrency(data.revenueModel.monthlyLossMin)} and {formatCurrency(data.revenueModel.monthlyLossMax)} every month simply because calls are going unanswered.
          </h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onGetLive} className="fx-btn fx-btn-primary">
              Get Live Within Days
            </button>
            {calUrl ? (
              <a href={calUrl} target="_blank" rel="noopener noreferrer" className="fx-btn fx-btn-ghost">
                Book a strategy call
              </a>
            ) : null}
          </div>
          {data.compliance.disclaimerShort ? (
            <p className={`mt-5 text-[10px] uppercase tracking-[0.18em] ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>
              {data.compliance.disclaimerShort}
            </p>
          ) : null}
        </section>
      </div>

      <RecoverDock
        label={`Recover ${formatCurrency(data.revenueModel.monthlyLossMidpoint)} / mo`}
        onClick={onGetLive}
      />
    </div>
  );
};
