import React, { useState } from 'react';
import { PRICING_MATRIX } from '../constants.tsx';

export const PricingMatrix: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-navy-200 dark:border-navy-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left bg-navy-50 dark:bg-navy-900/50 hover:bg-navy-100 dark:hover:bg-navy-800/50 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-navy-600 dark:text-navy-400">
          Pricing Matrix (for your call quotes)
        </span>
        <svg
          className={`w-4 h-4 text-navy-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-5 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-navy-200 dark:border-navy-700">
                  <th className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-3 pr-4">Tier</th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-3 pr-4">Monthly</th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-3 pr-4">Setup</th>
                  <th className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {PRICING_MATRIX.tiers.map((tier) => (
                  <tr key={tier.name} className="border-b border-navy-100 dark:border-navy-800">
                    <td className="py-3 pr-4 font-semibold text-navy-900 dark:text-white">{tier.name}</td>
                    <td className="py-3 pr-4 text-navy-700 dark:text-navy-200">${tier.monthly}/mo</td>
                    <td className="py-3 pr-4 text-navy-700 dark:text-navy-200">{typeof tier.setup === 'number' ? `$${tier.setup.toLocaleString()}` : tier.setup}</td>
                    <td className="py-3 text-navy-600 dark:text-navy-300">{tier.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="fx-ui-sans"><p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mb-2">Additional add-ons (quote live)</p>
            <ul className="space-y-1.5 text-sm text-navy-700 dark:text-navy-300">
              {PRICING_MATRIX.addOns.map((addon) => (
                <li key={addon.name} className="flex justify-between gap-4">
                  <span>{addon.name}</span>
                  <span className="font-medium text-navy-900 dark:text-white shrink-0">{addon.price}</span>
                </li>
              ))}
            </ul></div>
          </div>
          <p className="text-xs text-navy-600 dark:text-navy-400 italic">{PRICING_MATRIX.annualNote}</p>
        </div>
      )}
    </div>
  );
};
