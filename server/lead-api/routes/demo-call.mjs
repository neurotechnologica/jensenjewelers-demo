// POST /api/demo-call : guarded proxy in front of the n8n "voice-demo-request" webhook. The browser talks to THIS endpoint only;
// the n8n URL + shared secret live in the server environment. Order of checks (cheapest / most abusive-first):
//   kill switch -> (origin allow-list already enforced by the server core) -> per-IP burst limit -> body -> honeypot -> phone normalise + policy
//   -> do-not-call list -> captcha (Turnstile, optional) -> per-IP hourly/daily -> per-number cooldown + daily -> global daily cap -> forward to n8n.
// Only a request that passes everything consumes the per-number / global budget (so a typo or a bot cannot burn the daily cap).
import fs from 'node:fs';
import { RateLimiter, MIN, HOUR, DAY } from '../lib/ratelimit.mjs';
import { normalizePhone, maskPhone } from '../lib/phone.mjs';
import { verifyTurnstile } from '../lib/turnstile.mjs';
import { clientIp, send, corsHeaders, readJson } from '../lib/http.mjs';

const UUID_OR_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createDemoCallRoute(cfg, { log = console.log, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const d = cfg.demo;
  const burst = new RateLimiter([{ ms: MIN, max: 10 }], now); // cheap shield for the endpoint itself (valid or not)
  const perIp = new RateLimiter([{ ms: HOUR, max: d.perIpPerHour }, { ms: DAY, max: d.perIpPerDay }], now);
  const perNumber = new RateLimiter([{ ms: d.perNumberCooldownSec * 1000, max: 1 }, { ms: DAY, max: d.perNumberPerDay }], now);
  let dayKey = '', dayCount = 0;
  const state = () => ({ day: dayKey, count: dayCount });
  const dailyTake = () => {
    const k = new Date(now()).toISOString().slice(0, 10); // UTC day
    if (k !== dayKey) { dayKey = k; dayCount = 0; }
    if (dayCount >= d.perDay) return false;
    dayCount++; return true;
  };
  const dailyRefund = () => { if (dayCount > 0) dayCount--; };

  const blocked = (e164) => {
    if (d.blocklist.includes(e164)) return true;
    if (d.blocklistFile) { try { return fs.readFileSync(d.blocklistFile, 'utf8').split(/\r?\n/).map((x) => x.trim()).includes(e164); } catch { /* file missing = empty list */ } }
    return false;
  };
  const deny = (res, origin, status, code, error, extra = {}) => send(res, status, { ok: false, code, error }, { ...corsHeaders(origin), ...extra });

  async function handler(req, res, origin) {
    if (!d.enabled) return deny(res, origin, 503, 'paused', 'Demo calls are paused right now. Please book a call instead.');
    if (!d.webhookUrl) return deny(res, origin, 503, 'not_configured', 'Demo calls are not available right now.');
    const ip = clientIp(req, cfg);
    const b = burst.take(ip);
    if (!b.ok) return deny(res, origin, 429, 'rate_ip', 'Too many requests. Please wait a minute.', { 'retry-after': String(b.retryAfterSec) });

    let body;
    try { body = await readJson(req, 4096); } catch (e) { return deny(res, origin, e.status || 400, 'bad_request', e.message, e.status === 413 ? { connection: 'close' } : {}); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return deny(res, origin, 400, 'bad_request', 'Invalid request');
    if (typeof body.website === 'string' && body.website.trim()) { log('demo honeypot hit (dropped)'); return send(res, 200, { ok: true }, corsHeaders(origin)); } // bots think it worked

    const country = typeof body.country === 'string' && /^\+\d{1,3}$/.test(body.country) ? body.country : d.defaultCountry;
    const p = normalizePhone(String(body.phone ?? ''), { defaultCountry: country, allowed: d.allowedCountries });
    if (!p.ok) return deny(res, origin, 400, 'bad_phone', p.reason);
    const leadId = body.lead_id == null || body.lead_id === '' ? null : String(body.lead_id);
    if (leadId !== null && !UUID_OR_ID.test(leadId)) return deny(res, origin, 400, 'bad_lead_id', 'Invalid lead id');
    if (blocked(p.e164)) { log(`demo blocked (do-not-call) ${maskPhone(p.e164)}`); return deny(res, origin, 403, 'blocked', 'This number cannot be called.'); }

    const cap = await verifyTurnstile(d, body.turnstile_token, ip, fetchImpl);
    if (!cap.ok) return deny(res, origin, 403, cap.reason, 'Please complete the human check and try again.');

    const ipr = perIp.take(ip);
    if (!ipr.ok) return deny(res, origin, 429, 'rate_ip', 'You have reached the demo limit for now. Please try again later or book a call.', { 'retry-after': String(ipr.retryAfterSec) });
    const nr = perNumber.take(p.e164);
    if (!nr.ok) return deny(res, origin, 429, 'rate_number', 'This number was called very recently. Please wait before requesting another demo.', { 'retry-after': String(nr.retryAfterSec) });
    if (!dailyTake()) return deny(res, origin, 503, 'daily_cap', 'Our demo line is busy today. Please book a call instead.', { 'retry-after': '3600' });

    // forward: payload keeps the existing n8n contract {phone_number, lead_id}
    try {
      const headers = { 'content-type': 'application/json', 'user-agent': 'fourcee-demo-proxy/1' };
      if (d.webhookSecret) headers['x-fourcee-secret'] = d.webhookSecret;
      const r = await fetchImpl(d.webhookUrl, { method: 'POST', headers, body: JSON.stringify({ phone_number: p.e164, lead_id: leadId }), signal: AbortSignal.timeout(d.webhookTimeoutMs) });
      if (!r.ok) throw new Error(`n8n HTTP ${r.status}`);
    } catch (e) {
      dailyRefund(); // the call was not placed: give the budget back (per-number cooldown stays to stop hammering)
      log(`demo forward failed for ${maskPhone(p.e164)}: ${String(e.message).replace(/[\r\n]+/g, ' ')}`);
      return deny(res, origin, 502, 'upstream', 'We could not start the call. Please try again in a moment.');
    }
    log(`demo call requested ${maskPhone(p.e164)} (${state().count}/${d.perDay} today)`);
    return send(res, 200, { ok: true }, corsHeaders(origin));
  }
  handler.state = state;
  return handler;
}
