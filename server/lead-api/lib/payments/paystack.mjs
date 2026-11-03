// Paystack (ZAR for South African merchants), TEST MODE. Transaction is initialised server-side; the browser only gets authorization_url.
// Webhook: x-paystack-signature = hex HMAC-SHA512 of the raw body keyed with the secret key.
// PayFast could be added behind the same interface (initialise -> redirect, ITN signature check); it is not in this draft.
import { assertTestKey, tsEqual, hmac, fetchJson, SignatureError } from './common.mjs';

export function createPaystack(cfg, { fetchImpl = fetch } = {}) {
  const c = cfg.pay.paystack;
  assertTestKey('PAYSTACK_SECRET_KEY', c.secretKey);
  return {
    id: 'paystack',
    label: 'Card / EFT (Paystack, test mode)',
    currencies: ['ZAR'],
    enabled: !!c.secretKey,
    async createCheckout({ lead, amountMinor, currency, successUrl }) {
      assertTestKey('PAYSTACK_SECRET_KEY', c.secretKey);
      const reference = `fc_${lead.id.replace(/-/g, '').slice(0, 16)}_${Date.now().toString(36)}`;
      const j = await fetchJson(fetchImpl, `${c.apiBase}/transaction/initialize`, {
        method: 'POST',
        headers: { authorization: `Bearer ${c.secretKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email: lead.email, amount: amountMinor, currency, reference, callback_url: successUrl, metadata: { lead_id: lead.id } }),
      });
      const d = j?.data;
      if (!j?.status || !d?.authorization_url) throw new Error('Paystack returned no authorization_url');
      return { url: d.authorization_url, ref: d.reference || reference };
    },
    verifyWebhook(rawBody, headers) {
      const sig = String(headers['x-paystack-signature'] || '');
      if (!c.secretKey) throw new SignatureError('secret key not configured');
      if (!sig || !tsEqual(sig, hmac('sha512', c.secretKey, rawBody))) throw new SignatureError('signature mismatch');
      try { return JSON.parse(rawBody); } catch { throw new SignatureError('invalid JSON'); }
    },
    parseEvent(ev) {
      const d = ev?.data || {};
      const base = { eventId: `${ev?.event}:${d.id ?? d.reference ?? ''}`, leadId: d.metadata?.lead_id || '', ref: d.reference || '', amountMinor: d.amount ?? null, currency: String(d.currency || '').toUpperCase() };
      if (ev?.event === 'charge.success') return { ...base, status: d.status === 'success' ? 'paid' : 'ignored' };
      return { ...base, status: 'ignored' };
    },
  };
}

export function signPaystack(rawBody, secret) { return hmac('sha512', secret, rawBody); }
