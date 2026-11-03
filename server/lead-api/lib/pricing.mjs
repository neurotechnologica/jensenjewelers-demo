// Server-side price list. The browser NEVER sends the amount to charge: it sends a lead id, and the amount is recomputed here from the
// plan, billing cycle and add-ons stored on the lead. Prices mirror constants.tsx (USD); tests/payments-pricing.test.ts fails if they drift.
// ZAR: Fourcee quotes South African stores in ZAR. The owner sets the conversion with PAY_ZAR_PER_USD (rand per dollar, e.g. 18.5);
// without it ZAR checkout is refused, so no rand price is ever invented.
export const PLANS = {
  starter: { name: 'Starter', setup: 2500, monthly: 497, yearly: 4764 },
  pro: { name: 'Pro', setup: 5000, monthly: 997, yearly: 9564 },
  enterprise: { name: 'Enterprise', setup: 10000, monthly: 1997, yearly: 19164 },
  diamond: { name: 'Diamond', setup: 20000, monthly: 3499, yearly: 33588 },
};
export const UPSELLS = {
  white_glove_onboarding: { name: 'White-glove onboarding sprint', once: 1500, monthly: 0 },
  extra_location_pack: { name: 'Extra showroom location', once: 0, monthly: 399 },
};
export const UPSELL_IDS = Object.keys(UPSELLS);

/** Due today in USD, matching CheckoutFlow: annual = yearly + one-time add-ons (setup waived); monthly = setup + first month + monthly + one-time add-ons. */
export function quoteUsd({ plan, billing_cycle, upsells = [] }) {
  const p = PLANS[plan];
  if (!p) return null;
  const ups = [...new Set(upsells)].filter((u) => UPSELLS[u]);
  const once = ups.reduce((a, u) => a + UPSELLS[u].once, 0);
  const monthlyUps = ups.reduce((a, u) => a + UPSELLS[u].monthly, 0);
  const annual = billing_cycle === 'annual';
  const usd = annual ? p.yearly + once : p.setup + p.monthly + monthlyUps + once;
  const label = `${p.name} plan, ${annual ? 'annual (setup waived)' : 'setup + first month'}${ups.length ? ` + ${ups.map((u) => UPSELLS[u].name).join(', ')}` : ''}`;
  return { usd, label };
}

/** Amount to charge in minor units (cents) for a currency, or { error }. */
export function priceFor(lead, currency, cfg) {
  const q = quoteUsd({ plan: lead.plan, billing_cycle: lead.billing_cycle, upsells: lead.upsells || [] });
  if (!q) return { error: 'unknown_plan' };
  const cur = String(currency || '').toUpperCase();
  let major;
  if (cur === 'USD') major = q.usd;
  else if (cur === 'ZAR') {
    const rate = cfg.pay.zarPerUsd;
    if (!rate) return { error: 'zar_not_configured' };
    major = Math.round(q.usd * rate); // whole rand
  } else return { error: 'unsupported_currency' };
  const minor = Math.round(major * 100);
  if (minor <= 0 || minor > cfg.pay.maxMinor) return { error: 'amount_out_of_range' };
  return { amountMinor: minor, currency: cur, label: q.label };
}
