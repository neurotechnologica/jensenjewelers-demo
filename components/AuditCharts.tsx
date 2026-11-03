import React from 'react';

/** Bar chart metallic defs - unique ids (prefix cv-) */
function BarChartDefs() {
  return (
    <defs>
      <linearGradient id="cv-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f5e6c8" />
        <stop offset="35%" stopColor="#d4af37" />
        <stop offset="55%" stopColor="#fff8e7" />
        <stop offset="75%" stopColor="#b8860b" />
        <stop offset="100%" stopColor="#8a6e2a" />
      </linearGradient>
      <linearGradient id="cv-silver" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="40%" stopColor="#a8957a" />
        <stop offset="55%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#6b6358" />
      </linearGradient>
      <linearGradient id="cv-rose" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fecaca" />
        <stop offset="45%" stopColor="#b91c1c" />
        <stop offset="70%" stopColor="#7f1d1d" />
        <stop offset="100%" stopColor="#450a0a" />
      </linearGradient>
      <filter id="cv-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

export function CallVolumeBarChart({ callModel, isDarkMode = true }: { callModel: { inboundCallsPerWeekMin: number; inboundCallsPerWeekMax: number; answeredCallsPerWeekMin: number; answeredCallsPerWeekMax: number; missedCallsPerWeekMin: number; missedCallsPerWeekMax: number }; isDarkMode?: boolean }) {
  const avgInbound = Math.round((callModel.inboundCallsPerWeekMin + callModel.inboundCallsPerWeekMax) / 2);
  const avgAnswered = Math.round((callModel.answeredCallsPerWeekMin + callModel.answeredCallsPerWeekMax) / 2);
  const avgMissed = Math.round((callModel.missedCallsPerWeekMin + callModel.missedCallsPerWeekMax) / 2);
  const max = Math.max(avgInbound, avgAnswered, avgMissed, 46);
  const barMaxPx = 200;
  const bars = [
    { label: 'Estimated calls', value: avgInbound, grad: 'url(#cv-gold)', text: `${callModel.inboundCallsPerWeekMin}–${callModel.inboundCallsPerWeekMax} / wk` },
    { label: 'Answered calls', value: avgAnswered, grad: 'url(#cv-silver)', text: `${callModel.answeredCallsPerWeekMin}–${callModel.answeredCallsPerWeekMax} / wk` },
    { label: 'Missed calls', value: avgMissed, grad: 'url(#cv-rose)', text: `${callModel.missedCallsPerWeekMin}–${callModel.missedCallsPerWeekMax} / wk` },
  ];
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'border-navy-200 bg-white/90 shadow-[0_10px_30px_rgba(12,11,9,0.06)]'}`}>
      <h3 className={`audit-heading-font text-lg ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
        Call Volume &amp; Answer Rate
      </h3>
      <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Weekly estimates based on your audit model</p>
      <div className="mt-8 flex h-[240px] items-end justify-center gap-6 md:gap-12">
        <svg className="h-full w-full max-w-lg overflow-visible" viewBox="0 0 360 220" preserveAspectRatio="xMidYMax meet">
          <BarChartDefs />
          {bars.map((b, i) => {
            const h = Math.max(36, (b.value / max) * barMaxPx);
            const x = 40 + i * 100;
            const y = 200 - h;
            return (
              <g key={b.label} filter="url(#cv-glow)">
                <rect x={x} y={y} width="56" height={h} rx="6" fill={b.grad} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                <rect x={x + 4} y={y + 4} width="48" height={Math.min(12, h * 0.15)} rx="2" fill="rgba(255,255,255,0.12)" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        {bars.map((b) => (
          <div key={b.label} className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isDarkMode ? 'text-slate-400' : 'text-navy-500'}`}>{b.label}</p>
            <p className={`mt-1 text-xs font-semibold sm:text-sm ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>
              {b.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChartDefs() {
  return (
    <defs>
      <linearGradient id="rv-line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#a8957a" />
        <stop offset="40%" stopColor="#e2e8f0" />
        <stop offset="70%" stopColor="#d4af37" />
        <stop offset="100%" stopColor="#f5e6c8" />
      </linearGradient>
      <linearGradient id="rv-leak-area" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="rgba(212,175,55,0.45)" />
        <stop offset="40%" stopColor="rgba(200,181,143,0.25)" />
        <stop offset="100%" stopColor="rgba(12,11,9,0)" />
      </linearGradient>
      <linearGradient id="rv-node" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fff8e7" />
        <stop offset="50%" stopColor="#d4af37" />
        <stop offset="100%" stopColor="#5c4a1a" />
      </linearGradient>
      <filter id="rv-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

export function RevenueLeakLineChart({ lineSeries, currencySymbol, cumulativeLeak, isDarkMode = true }: { lineSeries: number[]; currencySymbol: string; cumulativeLeak: number; isDarkMode?: boolean }) {
  const points = lineSeries;
  const w = 400;
  const h = 180;
  const pad = 16;
  const maxY = Math.max(...points) * 1.1;
  const minY = 0;
  const toX = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const toY = (v: number) => h - pad - ((v - minY) / (maxY - minY)) * (h - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900' : 'border-navy-200 bg-white/90 shadow-[0_10px_30px_rgba(12,11,9,0.06)]'}`}>
      <h3 className={`audit-heading-font text-lg ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Your Hidden Revenue Leak</h3>
      <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Cumulative estimated missed revenue (6 months)</p>
      <div className="mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px]" aria-hidden>
          <LineChartDefs />
          <path
            d={`${d} L ${toX(points.length - 1)} ${h - pad} L ${toX(0)} ${h - pad} Z`}
            fill="url(#rv-leak-area)"
          />
          <path
            d={d}
            fill="none"
            stroke="url(#rv-line)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#rv-glow)"
          />
          {points.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r="5" fill="url(#rv-node)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
          ))}
        </svg>
        <div className={`mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>
          <span>Month 1</span>
          <span>Month 6</span>
        </div>
        <p className={`mt-3 text-right text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{currencySymbol}{cumulativeLeak.toLocaleString()}+ cumulative exposure</p>
      </div>
    </div>
  );
}

export function MissedCallDonutChart({ missedCallTypeSplit, isDarkMode = true }: { missedCallTypeSplit: Array<{ label: string; percent: number }>; isDarkMode?: boolean }) {
  const segments = missedCallTypeSplit.map((item, idx) => ({
    pct: item.percent,
    gradId: idx === 0 ? 'donut-gold' : idx === 1 ? 'donut-silver' : 'donut-steel',
    label: item.label
  }));
  let acc = 0;
  const r = 52;
  const cx = 60;
  const cy = 60;
  const paths = segments.map((seg) => {
    const start = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    acc += seg.pct;
    const end = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = seg.pct > 50 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, gradId: seg.gradId, label: seg.label, pct: seg.pct };
  });
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900' : 'border-navy-200 bg-white/90 shadow-[0_10px_30px_rgba(12,11,9,0.06)]'}`}>
      <h3 className={`audit-heading-font text-lg ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Missed Calls by Type</h3>
      <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Share of missed-call volume (estimated)</p>
      <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
        <svg viewBox="0 0 120 120" className="h-44 w-44 shrink-0">
          <defs>
            <linearGradient id="donut-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff8e7" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#6b5420" />
            </linearGradient>
            <linearGradient id="donut-silver" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="50%" stopColor="#a8957a" />
              <stop offset="100%" stopColor="#3a342b" />
            </linearGradient>
            <linearGradient id="donut-steel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#1f1c18" />
            </linearGradient>
          </defs>
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={`url(#${p.gradId})`}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.6"
            />
          ))}
          <circle cx={cx} cy={cy} r={28} fill="url(#donut-steel)" />
          <text x={cx} y={cy + 4} textAnchor="middle" className="fill-slate-200 text-[10px] font-bold">
            100%
          </text>
        </svg>
        <ul className="space-y-3 text-sm">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span
                className={`h-3 w-8 rounded-full shadow-inner ${
                  s.gradId === 'donut-gold'
                    ? 'bg-gradient-to-r from-amber-100 via-amber-400 to-amber-800'
                    : s.gradId === 'donut-silver'
                      ? 'bg-gradient-to-r from-slate-100 via-slate-400 to-slate-700'
                      : 'bg-gradient-to-r from-slate-300 via-slate-500 to-slate-900'
                }`}
              />
              <span className={isDarkMode ? 'text-slate-200' : 'text-navy-800'}>{s.label}</span>
              <span className={`font-semibold ${isDarkMode ? 'text-amber-100' : 'text-navy-900'}`}>{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BeforeAfterCards({ comparison, currencySymbol, isDarkMode = true }: { comparison: { currentAnsweredRate: number; currentMonthlyLoss: number; projectedAnsweredRate: number; projectedMonthlyLoss: number; comparisonFootnote: string }; currencySymbol: string; isDarkMode?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={`rounded-3xl border p-6 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-900/90 via-red-950/25 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'border-red-200 bg-gradient-to-br from-red-50 to-white shadow-[0_10px_30px_rgba(127,29,29,0.08)]'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${isDarkMode ? 'text-red-300/90' : 'text-red-800'}`}>Current situation</p>
        <p className={`mt-3 text-2xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{comparison.currentAnsweredRate}% answered</p>
        <p className={`mt-2 text-lg font-medium ${isDarkMode ? 'text-rose-200/95' : 'text-red-800'}`}>{currencySymbol}{comparison.currentMonthlyLoss.toLocaleString()} lost / month</p>
        <p className={`mt-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>{comparison.comparisonFootnote}</p>
      </div>
      <div className={`rounded-3xl border p-6 ${isDarkMode ? 'border-amber-400/25 bg-gradient-to-br from-zinc-950 via-amber-950/30 to-black shadow-[inset_0_1px_0_rgba(212,175,55,0.18)]' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-[0_10px_30px_rgba(5,46,22,0.08)]'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${isDarkMode ? 'text-amber-200/95' : 'text-emerald-900'}`}>With Fourcee AI</p>
        <p className={`mt-3 text-2xl font-semibold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{comparison.projectedAnsweredRate}% answered</p>
        <p className={`mt-2 text-lg font-medium ${isDarkMode ? 'text-amber-200/95' : 'text-emerald-900'}`}>{currencySymbol}{comparison.projectedMonthlyLoss} lost to missed calls</p>
        <p className={`mt-3 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Projected after full deployment and team handoff</p>
      </div>
    </div>
  );
}

export function GbpSnapshotMockup({
  reviews,
  isDarkMode = true,
}: {
  reviews: { rating: number; count: number; starsDisplay: string; quote1: string; quote2: string; themes?: string[] };
  isDarkMode?: boolean;
}) {
  const themes = reviews.themes?.filter(Boolean) ?? [];
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950 to-black' : 'border-navy-200 bg-white/90 shadow-[0_10px_30px_rgba(12,11,9,0.06)]'}`}>
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.7 12 2.7A9.3 9.3 0 0 0 2.7 12c0 5.1 4.2 9.3 9.3 9.3 5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.1-1.9H12z" />
          <path fill="#4285F4" d="M3.8 7.9l3.2 2.4A5.6 5.6 0 0 1 12 6.1c1.8 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.7 12 2.7c-3.6 0-6.8 2.1-8.2 5.2z" />
          <path fill="#FBBC05" d="M12 21.3c2.6 0 4.8-.9 6.4-2.5l-3-2.4c-.8.6-1.9 1-3.4 1-2.5 0-4.7-1.7-5.4-4l-3.3 2.5A9.3 9.3 0 0 0 12 21.3z" />
          <path fill="#34A853" d="M3.3 15.9l3.3-2.5c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6L3.3 7.9A9.4 9.4 0 0 0 2.7 12c0 1.4.2 2.7.6 3.9z" />
        </svg>
        <h3 className={`audit-heading-font text-lg ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Google Business Profile Snapshot</h3>
      </div>
      <div className={`mt-4 rounded-2xl border p-5 shadow-inner ${isDarkMode ? 'border-white/10 bg-black/50' : 'border-navy-200 bg-slate-50'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-lg ${isDarkMode ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.55)]' : 'text-amber-800'}`}
          >
            {reviews.starsDisplay}
          </span>
          <span className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{reviews.rating.toFixed(1)} out of 5</span>
          <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-navy-500'}`}>({reviews.count.toLocaleString()} reviews)</span>
        </div>
        {reviews.quote1 ? (
          <p className={`mt-4 text-sm italic leading-relaxed ${isDarkMode ? 'text-slate-100' : 'text-[#1a1714]'}`}>
            &ldquo;{reviews.quote1}&rdquo;
          </p>
        ) : null}
        {reviews.quote2 ? (
          <p className={`mt-2 text-sm italic leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-[#3a342b]'}`}>
            &ldquo;{reviews.quote2}&rdquo;
          </p>
        ) : null}
        <p className={`mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-200' : 'text-[#1a1714]'}`}>Representative themes from public reviews</p>
        {themes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {themes.map((theme) => (
              <span
                key={theme}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  isDarkMode ? 'border-white/15 text-slate-300' : 'border-navy-200 text-navy-700'
                }`}
              >
                {theme}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TrafficPieChart({ trafficSources, isDarkMode = true }: { trafficSources: Array<{ label: string; percent: number; colorKey: string }>; isDarkMode?: boolean }) {
  const palette = [
    {
      fill: isDarkMode ? '#ffffff' : '#0c0b09',
      legend: isDarkMode ? 'bg-white' : 'bg-navy-900',
      stroke: isDarkMode ? '#0c0b09' : '#ffffff',
    },
    {
      fill: isDarkMode ? '#d4af37' : '#d4af37',
      legend: 'bg-[#d4af37]',
      stroke: isDarkMode ? '#0c0b09' : '#ffffff',
    },
    {
      fill: isDarkMode ? '#38bdf8' : '#0369a1',
      legend: isDarkMode ? 'bg-sky-400' : 'bg-sky-700',
      stroke: isDarkMode ? '#0c0b09' : '#ffffff',
    },
  ];

  const slices = trafficSources.map((source, idx) => ({
    label: source.label,
    pct: source.percent,
    fill: palette[idx % palette.length].fill,
    legendClass: palette[idx % palette.length].legend,
    stroke: palette[idx % palette.length].stroke,
  }));
  let acc = 0;
  const r = 45;
  const cx = 50;
  const cy = 50;
  const paths = slices.map((seg) => {
    const start = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    acc += seg.pct;
    const end = (acc / 100) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = seg.pct > 50 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    return { d, fill: seg.fill, legendClass: seg.legendClass, stroke: seg.stroke, label: seg.label, pct: seg.pct };
  });
  return (
    <div className={`rounded-[2rem] border p-6 md:p-8 ${isDarkMode ? 'border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900' : 'border-navy-200 bg-white/90 shadow-[0_10px_30px_rgba(12,11,9,0.06)]'}`}>
      <h3 className={`audit-heading-font text-lg ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>Where your calls are coming from</h3>
      <p className={`mt-1 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Traffic source mix (illustrative)</p>
      <div className="mt-6 flex flex-col items-center gap-4 md:flex-row md:justify-center">
        <svg viewBox="0 0 100 100" className="h-36 w-36">
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth="0.9" />
          ))}
        </svg>
        <div className={`w-full max-w-[240px] rounded-2xl border p-4 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-navy-200 bg-slate-50'}`}>
          <p className={`mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-400' : 'text-navy-600'}`}>Legend</p>
          <ul className="space-y-2 text-sm">
          {slices.map((s) => (
            <li key={s.label} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${isDarkMode ? 'border-white/10 bg-black/40' : 'border-navy-200 bg-white'}`}>
              <span className={`h-2.5 w-8 rounded-full shadow-inner ${s.legendClass}`} />
              <span className={`flex-1 ${isDarkMode ? 'text-slate-200' : 'text-navy-800'}`}>{s.label}</span>
              <span className={`font-medium ${isDarkMode ? 'text-slate-100' : 'text-navy-900'}`}>{s.pct}%</span>
            </li>
          ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SectionTrustFooter({ dataSourceLine, isDarkMode = true }: { dataSourceLine: string; isDarkMode?: boolean }) {
  return (
    <p className={`mt-4 text-center text-[10px] leading-relaxed sm:text-left ${isDarkMode ? 'text-slate-400' : 'text-navy-500'}`}>
      {dataSourceLine}
    </p>
  );
}
