// Stripe Checkout (hosted page), TEST MODE. Session is created server-side; the browser only receives the redirect URL.
// Webhook: Stripe-Signature = t=<unix>,v1=<hex hmac-sha256 of "<t>.<raw body>" with the webhook signing secret>.
import { assertTestKey, tsEqual, hmac, form, fetchJson, SignatureError } from './common.mjs';

export const STRIPE_TOLERANCE_SEC = 300;

export function createStripe(cfg, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  const c = cfg.pay.stripe;
  assertTestKey('STRIPE_SECRET_KEY', c.secretKey);
  return {
    id: 'stripe',
    label: 'Card (Stripe, test mode)',
    currencies: ['USD', 'ZAR'],
    enabled: !!c.secretKey && !!c.webhookSecret,
    async createCheckout({ lead, amountMinor, currency, label, successUrl, cancelUrl }) {
      assertTestKey('STRIPE_SECRET_KEY', c.secretKey);
      const body = form({
        mode: 'payment',
        success_url: successUrl, cancel_url: cancelUrl,
        client_reference_id: lead.id, customer_email: lead.email,
        'metadata[lead_id]': lead.id,
        'payment_intent_data[metadata][lead_id]': lead.id,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': amountMinor,
        'line_items[0][price_data][product_data][name]': `Fourcee: ${label}`.slice(0, 250),
      });
      const j = await fetchJson(fetchImpl, `${c.apiBase}/v1/checkout/sessions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${c.secretKey}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': `fourcee-${lead.id}-${amountMinor}-${currency}-${lead.payment?.attempt || 0}` },
        body,
      });
      if (!j?.id || !j?.url) throw new Error('Stripe returned no session');
      return { url: j.url, ref: j.id };
    },
    /** Throws SignatureError unless the header is a valid, fresh signature of rawBody. Returns the parsed event. */
    verifyWebhook(rawBody, headers) {
      const sig = String(headers['stripe-signature'] || '');
      if (!c.webhookSecret) throw new SignatureError('webhook secret not configured');
      const parts = Object.fromEntries(sig.split(',').map((p) => p.trim().split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
      const all = sig.split(',').map((p) => p.trim()).filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      const t = Number(parts.t);
      if (!t || !all.length) throw new SignatureError('malformed signature header');
      if (Math.abs(now() / 1000 - t) > STRIPE_TOLERANCE_SEC) throw new SignatureError('timestamp outside tolerance');
      const expected = hmac('sha256', c.webhookSecret, `${t}.${rawBody}`);
      if (!all.some((v) => tsEqual(v, expected))) throw new SignatureError('signature mismatch');
      try { return JSON.parse(rawBody); } catch { throw new SignatureError('invalid JSON'); }
    },
    /** Event -> { eventId, leadId, ref, status: 'paid'|'failed'|'expired'|'ignored', amountMinor, currency } */
    parseEvent(ev) {
      const o = ev?.data?.object || {};
      const base = { eventId: ev?.id || '', leadId: o.client_reference_id || o.metadata?.lead_id || '', ref: o.id || '', amountMinor: o.amount_total ?? null, currency: String(o.currency || '').toUpperCase() };
      switch (ev?.type) {
        case 'checkout.session.completed': return { ...base, status: o.payment_status === 'paid' ? 'paid' : 'ignored' }; // 'unpaid' = async method still pending
        case 'checkout.session.async_payment_succeeded': return { ...base, status: 'paid' };
        case 'checkout.session.async_payment_failed': return { ...base, status: 'failed' };
        case 'checkout.session.expired': return { ...base, status: 'expired' };
        default: return { ...base, status: 'ignored' };
      }
    },
  };
}

/** Test helper: build the header Stripe would send. */
export function signStripe(rawBody, secret, t = Math.floor(Date.now() / 1000)) { return `t=${t},v1=${hmac('sha256', secret, `${t}.${rawBody}`)}`; }
