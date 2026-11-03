
import React, { useState, useMemo } from 'react';
import { formatRoiMonths, paybackMonths, roiMonthsPhrase } from '../lib/prospect-fixes';

export interface ValueCalculatorProps {
  /** When false, uses high-contrast light panel (for light page theme). */
  isDarkMode?: boolean;
  businessName?: string;
}

export const ValueCalculator: React.FC<ValueCalculatorProps> = ({
  isDarkMode = true,
  businessName = 'PLACEHOLDER Business', // Neuro token — do not rename
}) => {
  const [avgValue, setAvgValue] = useState(5000);
  const [missedCalls, setMissedCalls] = useState(20);
  const [staffSalary, setStaffSalary] = useState(3500);
  const [showInsights, setShowInsights] = useState(false);

  const results = useMemo(() => {
    const months = 12;
    const recoveryRate = 0.2;
    const automationShare = 0.3;

    const extraBookingsPerMonth = missedCalls * recoveryRate;
    const extraBookingsYear = extraBookingsPerMonth * months;
    const addedRevenue = extraBookingsYear * avgValue;

    const staffingSavings = staffSalary * months * automationShare;
    const totalBenefit = addedRevenue + staffingSavings;
    const monthlyBenefit = totalBenefit / months || 0;
    const firstMonthHurdle = 997;
    const roiMonths = paybackMonths(monthlyBenefit, firstMonthHurdle);

    return {
      annual: totalBenefit,
      roiMonths,
      recoveryRate,
      automationShare,
      extraBookingsPerMonth,
      extraBookingsYear,
      addedRevenue,
      staffingSavings,
      monthlyBenefit,
    };
  }, [avgValue, missedCalls, staffSalary]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const roiMonthsLabel = formatRoiMonths(results.roiMonths);
  const roiPill = roiMonthsPhrase(results.roiMonths);

  const rangeClass = isDarkMode
    ? 'h-2 w-full cursor-pointer appearance-none rounded-full bg-white/28 accent-amber-300 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-amber-200/80 [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-amber-50 [&::-webkit-slider-thumb]:to-amber-600 [&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(253,224,71,0.55)]'
    : 'h-2.5 w-full cursor-pointer appearance-none rounded-full bg-[#1a1714] accent-emerald-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-navy-300 [&::-webkit-slider-thumb]:bg-navy-900 [&::-webkit-slider-thumb]:shadow-md';

  const shell = isDarkMode
    ? 'border-white/15 bg-gradient-to-br from-zinc-950/90 via-zinc-900 to-zinc-950 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:p-10'
    : 'liquid-glass border-[#c8b58f]/40 bg-[rgba(250,245,234,0.7)] p-5 shadow-[0_12px_40px_rgba(12,11,9,0.08)] md:p-8';

  const titleClass = isDarkMode ? 'serif text-base sm:text-lg font-bold text-white tracking-wide' : 'serif text-base sm:text-lg font-bold text-navy-900 tracking-wide';
  const subtitleClass = isDarkMode
    ? 'mb-6 mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-100 sm:text-xs'
    : 'mb-6 mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-700 sm:text-xs';
  const labelClass = isDarkMode
    ? 'mb-3 flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-slate-100'
    : 'mb-3 flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-navy-700';
  const valueClass = isDarkMode ? 'text-white' : 'text-navy-900';
  const dividerClass = isDarkMode ? 'border-t border-white/15' : 'border-t border-navy-200';
  const smallLabelClass = isDarkMode
    ? 'text-[10px] font-bold uppercase tracking-[0.14em] text-slate-100'
    : 'text-[10px] font-bold uppercase tracking-[0.14em] text-navy-700';
  const bigNumberClass = isDarkMode ? 'serif mt-1 text-2xl sm:text-3xl font-bold text-white' : 'serif mt-1 text-2xl sm:text-3xl font-bold text-navy-900';
  const roiPillClass = isDarkMode
    ? 'rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-950/80 to-zinc-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-amber-50 shadow-[0_0_20px_rgba(212,175,55,0.2)]'
    : 'rounded-full border border-emerald-700 bg-emerald-900 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md';
  const infoBtnClass = isDarkMode
    ? 'mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-100 transition-colors hover:text-white'
    : 'mt-2 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-700 transition-colors hover:text-navy-900';
  const infoIconClass = isDarkMode
    ? 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[9px] font-semibold text-white'
    : 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-navy-200 bg-white text-[9px] font-semibold text-navy-800';
  const insightsShell = isDarkMode
    ? 'mt-4 space-y-2 rounded-2xl border border-white/15 bg-black/50 px-5 py-4 text-xs leading-relaxed text-slate-200'
    : 'mt-4 space-y-2 rounded-2xl border border-navy-200 bg-white px-5 py-4 text-xs leading-relaxed text-navy-800';
  const insightsHeading = isDarkMode ? 'text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-100' : 'text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-900';
  const insightsStrong = isDarkMode ? 'font-semibold text-white' : 'font-semibold text-navy-900';

  return (
    <div className={`w-full min-w-0 rounded-[2rem] border ${shell}`}>
      <h3 className={titleClass}>{businessName} Value Calculator</h3>
      <p className={subtitleClass}>
        Calculate ROI now for {businessName} - see if Fourcee is even worth it for your current setup.
      </p>

      <div className="space-y-8">
        <div>
          <label className={labelClass}>
            <span>Avg. Piece Value</span>
            <span className={valueClass}>${avgValue.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="1000"
            max="50000"
            step="500"
            value={avgValue}
            onChange={(e) => setAvgValue(parseInt(e.target.value, 10))}
            className={rangeClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            <span>Monthly Missed Calls</span>
            <span className={valueClass}>{missedCalls}</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={missedCalls}
            onChange={(e) => setMissedCalls(parseInt(e.target.value, 10))}
            className={rangeClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            <span>Monthly Staff Salary Cost</span>
            <span className={valueClass}>${staffSalary.toLocaleString()}</span>
          </label>
          <input
            type="range"
            min="1000"
            max="10000"
            step="100"
            value={staffSalary}
            onChange={(e) => setStaffSalary(parseInt(e.target.value, 10))}
            className={rangeClass}
          />
        </div>

        <div className={`flex flex-col items-start justify-between gap-6 pt-8 sm:flex-row sm:items-center ${dividerClass}`}>
          <div>
            <p className={smallLabelClass}>Est. Annual Value</p>
            <p className={bigNumberClass}>{formatCurrency(results.annual)}</p>
          </div>
          <div className={roiPillClass}>{roiPill}</div>
        </div>

        <button type="button" onClick={() => setShowInsights((prev) => !prev)} className={infoBtnClass}>
          <span className={infoIconClass}>i</span>
          <span>Show the math behind this ROI</span>
        </button>

        {showInsights && (
          <div className={insightsShell}>
            <p className={insightsHeading}>How we arrive at your annual value</p>
            <p>
              • Missed-call recovery: {missedCalls} missed calls/month × {(results.recoveryRate * 100).toFixed(0)}% of
              those saved by Fourcee × 12 months × {formatCurrency(avgValue)} average piece value ≈{' '}
              <span className={insightsStrong}>{formatCurrency(results.addedRevenue)}</span> in reclaimed sales
              opportunity.
            </p>
            <p>
              • Front-desk efficiency: assuming Fourcee quietly handles {(results.automationShare * 100).toFixed(0)}%
              of your phone load, that&apos;s about{' '}
              <span className={insightsStrong}>{formatCurrency(results.staffingSavings)}</span> per year in staff time
              you can redirect to white-glove client work instead of chasing the phone.
            </p>
            <p>
              • Combined lift: {formatCurrency(results.addedRevenue)} + {formatCurrency(results.staffingSavings)} ≈{' '}
              <span className={insightsStrong}>{formatCurrency(results.annual)}</span> extra economic value flowing
              through your showroom each year at these inputs.
            </p>
            {roiMonthsLabel !== '—' && (
              <p>
                • Payback window (illustrative): first month subscription (e.g. {formatCurrency(997)} on Pro, setup
                waived on annual) vs about{' '}
                <span className={insightsStrong}>{formatCurrency(results.monthlyBenefit)}</span> of monthly uplift →
                roughly <span className={insightsStrong}>{roiMonthsLabel === 'under 1' ? 'under 1 month' : `${roiMonthsLabel} months`}</span> to break even on that month,
                then upside.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
