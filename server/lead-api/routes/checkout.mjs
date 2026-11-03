// Payments (TEST MODE ONLY in this build).
//   GET  /api/checkout/options          what the browser may offer: enabled providers x currencies (no secrets)
//   POST /api/checkout                  { lead_id, provider, currency } -> creates a hosted Checkout Session server-side -> { url }
//   GET  /api/checkout/status?lead_id=  { paymentStatus } for the "payment received" banner after the redirect back
//   POST /api/pay/webhook/stripe|paystack   provider -> us. Signature verified over the RAW body; marks the lead paid/failed idempotently.
// The charged amount is computed here from the lead (plan, billing cycle, add-ons). The browser can never choose it.
import { RateLimiter, HOUR } from '../lib/ratelimit.mjs';
import { priceFor } from '../lib/pricing.mjs';
import { createPayments } from '../lib/payments/index.mjs';
import { notifyPayment } from '../lib/notify-payment.mjs';
import { clientIp, send, corsHeaders, readJson } from '../lib/http.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 50;

function readRaw(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false; const chunks = [];
    req.on('data', (c) => { if (over) return; size += c.length; if (size > maxBytes) { over = true; chunks.length = 0; reject(Object.assign(new Error('Body too large'), { status: 413 })); return; } chunks.push(c); });
    req.on('end', () => { if (!over) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

export function createCheckoutRoutes(cfg, { log = console.log, fetchImpl = fetch, now = () => Date.now(), notifyDeps = {} } = {}) {
  const pay = cfg.pay;
  const payments = createPayments(cfg, { fetchImpl, now }); // throws if a live key is configured
  const perIp = new RateLimiter([{ ms: HOUR, max: pay.perIpPerHour }], now);
  const returnBase = (pay.returnBase || cfg.allowedOrigins[0] || '').replace(/\/?$/, '/');
  const enabledProviders = () => (pay.enabled ? payments.enabled() : []);
  const deny = (res, origin, status, code, error) => send(res, status, { ok: false, code, error }, corsHeaders(origin));
  const choices = () => enabledProviders().flatMap((p) => p.currencies.filter((c) => c !== 'ZAR' || pay.zarPerUsd).map((c) => ({ provider: p.id, label: p.label, currency: c })));

  async function options(req, res, origin) {
    send(res, 200, { ok: true, enabled: pay.enabled && choices().length > 0, mode: 'test', choices: choices() }, corsHeaders(origin));
  }

  async function create(req, res, origin, ctx) {
    if (!pay.enabled || !enabledProviders().length) return deny(res, origin, 503, 'payments_off', 'Online payment is not available right now. We will send you an invoice instead.');
    const rl = perIp.take(clientIp(req, cfg));
    if (!rl.ok) return send(res, 429, { ok: false, code: 'rate_limited', error: 'Too many attempts. Please try again later.' }, { ...corsHeaders(origin), 'retry-after': String(rl.retryAfterSec) });
    let body;
    try { body = await readJson(req, 2048); } catch (e) { return deny(res, origin, e.status || 400, 'bad_request', e.message); }
    const leadId = String(body?.lead_id || '');
    if (!UUID.test(leadId)) return deny(res, origin, 400, 'bad_lead', 'Unknown request reference.');
    const lead = await ctx.store.get(leadId);
    if (!lead) return deny(res, origin, 404, 'bad_lead', 'Unknown request reference.');
    if (lead.paymentStatus === 'paid') return deny(res, origin, 409, 'already_paid', 'This request is already paid.');
    const currency = String(body?.currency || 'USD').toUpperCase();
    const provider = payments.pick(currency, body?.provider ? String(body.provider) : undefined);
    if (!provider || !enabledProviders().includes(provider)) return deny(res, origin, 400, 'bad_provider', 'That payment method is not available.');
    const price = priceFor(lead, currency, cfg);
    if (price.error) return deny(res, origin, price.error === 'zar_not_configured' ? 503 : 400, price.error, price.error === 'zar_not_configured' ? 'Rand pricing is not available yet. We will send you a ZAR quote.' : 'We cannot price this request online. We will send you an invoice.');
    const prev = lead.payment || {};
    const attempt = (prev.attempt || 0) + 1;
    if (attempt > pay.maxAttemptsPerLead) return deny(res, origin, 429, 'too_many_attempts', 'Too many payment attempts for this request. Please contact us.');
    const successUrl = `${returnBase}?pay=success&lead=${lead.id}#/checkout`;
    const cancelUrl = `${returnBase}?pay=cancel&lead=${lead.id}#/checkout`;
    let session;
    try {
      session = await provider.createCheckout({ lead: { ...lead, payment: { ...prev, attempt } }, amountMinor: price.amountMinor, currency: price.currency, label: price.label, successUrl, cancelUrl });
    } catch (e) {
      log(`checkout ${lead.id} ${provider.id} failed: ${e.message}`);
      return deny(res, origin, 502, 'provider_error', 'We could not start the payment. Please try again, or we will send you an invoice.');
    }
    const sessions = { ...(prev.sessions || {}), [session.ref]: { provider: provider.id, amountMinor: price.amountMinor, currency: price.currency, createdAt: new Date(now()).toISOString() } };
    await ctx.store.update(lead.id, {
      paymentStatus: 'pending',
      payment: { ...prev, mode: 'test', provider: provider.id, ref: session.ref, amountMinor: price.amountMinor, currency: price.currency, status: 'pending', attempt, sessions, events: prev.events || [] },
    });
    log(`checkout ${lead.id} ${provider.id} ${price.currency} ${price.amountMinor} session created`);
    return send(res, 200, { ok: true, url: session.url, mode: 'test' }, corsHeaders(origin));
  }

  async function status(req, res, origin, ctx) {
    const id = new URL(req.url, 'http://x').searchParams.get('lead_id') || '';
    if (!UUID.test(id)) return deny(res, origin, 400, 'bad_lead', 'Unknown request reference.');
    const lead = await ctx.store.get(id);
    if (!lead) return deny(res, origin, 404, 'bad_lead', 'Unknown request reference.');
    return send(res, 200, { ok: true, paymentStatus: lead.paymentStatus || 'unpaid', mode: 'test' }, corsHeaders(origin));
  }

  const webhook = (providerId) => {
    const handler = async (req, res, origin, ctx) => {
      const provider = payments.providers[providerId];
      if (!pay.enabled || !provider.enabled) return send(res, 503, { ok: false, error: 'payments off' });
      let raw;
      try { raw = await readRaw(req, 256 * 1024); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }); }
      let ev;
      try { ev = provider.verifyWebhook(raw, req.headers); } catch (e) { log(`webhook ${providerId} rejected: ${e.message}`); return send(res, 400, { ok: false, error: 'invalid signature' }); }
      const p = provider.parseEvent(ev);
      if (p.status === 'ignored' || !UUID.test(p.leadId)) return send(res, 200, { ok: true, ignored: true });
      const lead = await ctx.store.get(p.leadId);
      const sess = lead?.payment?.sessions?.[p.ref];
      if (!lead || !sess || sess.provider !== providerId) { log(`webhook ${providerId}: unknown lead/session ${p.leadId}`); return send(res, 200, { ok: true, ignored: true }); }
      const pay0 = lead.payment;
      if (p.eventId && pay0.events.includes(p.eventId)) return send(res, 200, { ok: true, duplicate: true }); // provider retry
      const events = [...pay0.events, p.eventId].filter(Boolean).slice(-MAX_EVENTS);
      const at = new Date(now()).toISOString();
      if (p.status === 'paid') {
        if (p.amountMinor !== sess.amountMinor || p.currency !== sess.currency) {
          log(`webhook ${providerId}: AMOUNT MISMATCH lead ${lead.id} expected ${sess.amountMinor} ${sess.currency} got ${p.amountMinor} ${p.currency}`);
          await ctx.store.update(lead.id, { paymentStatus: lead.paymentStatus === 'paid' ? 'paid' : 'review', payment: { ...pay0, events, status: lead.paymentStatus === 'paid' ? pay0.status : 'mismatch', mismatch: { ref: p.ref, amountMinor: p.amountMinor, currency: p.currency, at } } });
          return send(res, 200, { ok: true, flagged: true });
        }
        if (lead.paymentStatus === 'paid') { // a second, different session also paid: keep the first, flag for a refund decision
          await ctx.store.update(lead.id, { payment: { ...pay0, events, duplicatePaid: [...(pay0.duplicatePaid || []), { ref: p.ref, at }] } });
          log(`lead ${lead.id} paid twice (${p.ref}); needs a manual refund decision`);
          return send(res, 200, { ok: true, duplicate: true });
        }
        const updated = await ctx.store.update(lead.id, { paymentStatus: 'paid', payment: { ...pay0, status: 'paid', provider: providerId, ref: p.ref, amountMinor: sess.amountMinor, currency: sess.currency, paidAt: at, events } });
        log(`lead ${lead.id} PAID (test) ${providerId} ${sess.currency} ${sess.amountMinor}`);
        notifyPayment(updated, cfg, { fetchImpl, ...notifyDeps, log }).catch(() => {});
        return send(res, 200, { ok: true });
      }
      if (lead.paymentStatus !== 'paid') {
        const st = p.status === 'failed' ? 'failed' : 'unpaid';
        await ctx.store.update(lead.id, { paymentStatus: st, payment: { ...pay0, status: p.status, events } });
      } else await ctx.store.update(lead.id, { payment: { ...pay0, events } });
      return send(res, 200, { ok: true });
    };
    handler.serverToServer = true; // no browser Origin: the signature is the authentication
    return handler;
  };

  return {
    routes: {
      'GET /api/checkout/options': options,
      'POST /api/checkout': create,
      'GET /api/checkout/status': status,
      'POST /api/pay/webhook/stripe': webhook('stripe'),
      'POST /api/pay/webhook/paystack': webhook('paystack'),
    },
    payments,
  };
}
