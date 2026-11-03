import { createStripe } from './stripe.mjs';
import { createPaystack } from './paystack.mjs';

/** Provider registry. Throws at start-up if any configured key is not a test key. */
export function createPayments(cfg, deps = {}) {
  const providers = { stripe: createStripe(cfg, deps), paystack: createPaystack(cfg, deps) };
  const enabled = () => Object.values(providers).filter((p) => p.enabled);
  return {
    providers,
    enabled,
    get: (id) => providers[id] && providers[id].enabled ? providers[id] : null,
    /** Default provider for a currency: the first enabled one that supports it (ZAR prefers Paystack, USD prefers Stripe). */
    pick(currency, wanted) {
      if (wanted) { const p = providers[wanted]; return p && p.enabled && p.currencies.includes(currency) ? p : null; }
      const order = currency === 'ZAR' ? ['paystack', 'stripe'] : ['stripe', 'paystack'];
      return order.map((k) => providers[k]).find((p) => p.enabled && p.currencies.includes(currency)) || null;
    },
  };
}
