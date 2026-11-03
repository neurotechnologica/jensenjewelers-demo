// Fourcee lead receiver: browser "Request invoice" -> POST /api/lead -> stored (JSON file) -> owner notified (SMTP and/or webhook).
// Zero dependencies (node >= 18). Not deployed by this repo; see README.md for the nginx + systemd recipe.
// Routes are registered in ROUTES so further endpoints (demo-call guard, checkout) plug into the same process, origin list and limiter helpers.
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { createStore } from './lib/store.mjs';
import { RateLimiter, MIN, HOUR, DAY } from './lib/ratelimit.mjs';
import { validateLead, isHoneypotHit } from './lib/validate.mjs';
import { notifyLead, notifyEnabled } from './lib/notify.mjs';
import { createDemoCallRoute } from './routes/demo-call.mjs';
import { createCheckoutRoutes } from './routes/checkout.mjs';
import { clientIp, send, checkOrigin, corsHeaders, readJson } from './lib/http.mjs';

export { loadConfig };

export async function createLeadApi(cfg = loadConfig(), deps = {}) {
  const log = deps.log || ((...a) => console.log(new Date().toISOString(), ...a));
  const store = deps.store || (await createStore(cfg));
  const ipLimiter = new RateLimiter([{ ms: MIN, max: cfg.rate.perMin }, { ms: HOUR, max: cfg.rate.perHour }, { ms: DAY, max: cfg.rate.perDay }], deps.now);
  const ctx = { cfg, store, log, deps, ipLimiter, notifyDeps: deps.notifyDeps || {} };

  async function runNotify(lead) {
    const state = await notifyLead(lead, cfg, ctx.notifyDeps);
    await store.update(lead.id, { notify: state });
    if (state.lastError) log(`lead ${lead.id} notify attempt ${state.attempts} failed: ${state.lastError}`);
    return state;
  }

  async function handleLead(req, res, origin) {
    const ip = clientIp(req, cfg);
    const rl = ipLimiter.take(ip);
    if (!rl.ok) return send(res, 429, { ok: false, error: 'Too many requests. Please try again shortly.' }, { ...corsHeaders(origin), 'retry-after': String(rl.retryAfterSec) });
    let body;
    try { body = await readJson(req, cfg.maxBodyBytes); } catch (e) { return send(res, e.status || 400, { ok: false, error: e.message }, { ...corsHeaders(origin), ...(e.status === 413 ? { connection: 'close' } : {}) }); }
    if (isHoneypotHit(body)) { log('honeypot hit (dropped)'); return send(res, 200, { ok: true, id: crypto.randomUUID() }, corsHeaders(origin)); } // look successful to the bot
    const v = validateLead(body);
    if (!v.ok) return send(res, 400, { ok: false, error: 'Validation failed', fields: v.errors }, corsHeaders(origin));
    const dup = await store.findByIdempotencyKey(v.value.idempotency_key);
    if (dup) return send(res, 200, { ok: true, id: dup.id, duplicate: true }, corsHeaders(origin));
    if ((await store.countSince(Date.now() - DAY)) >= cfg.globalPerDay) {
      log('global daily lead cap reached');
      return send(res, 503, { ok: false, error: 'Service busy. Please email us instead.' }, { ...corsHeaders(origin), 'retry-after': '3600' });
    }
    const lead = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...v.value,
      paymentStatus: 'unpaid',
      ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16), // not the raw IP
      userAgent: String(req.headers['user-agent'] || '').slice(0, 160),
      notify: { email: 'pending', webhook: 'pending', confirmation: 'pending', attempts: 0, done: false },
    };
    await store.add(lead); // stored BEFORE we answer: a 201 means the lead is on disk
    log(`lead ${lead.id} stored (${lead.plan})`);
    runNotify(lead).catch((e) => log(`lead ${lead.id} notify crashed: ${e.message}`)); // fire and forget; sweep retries
    return send(res, 201, { ok: true, id: lead.id }, corsHeaders(origin));
  }

  /** Retry notifications that failed earlier. Called by the timer; exported for tests. */
  async function sweep() {
    let n = 0;
    for (const l of await store.pendingNotifications(cfg.notifyMaxAttempts)) { await runNotify(l); n++; }
    return n;
  }

  const ROUTES = {
    'POST /api/lead': handleLead,
    'POST /api/demo-call': createDemoCallRoute(cfg, { log, fetchImpl: deps.fetchImpl, now: deps.now }),
    ...createCheckoutRoutes(cfg, { log, fetchImpl: deps.fetchImpl, now: deps.now, notifyDeps: ctx.notifyDeps }).routes, // test-mode payments (off unless PAYMENTS_ENABLED=1)
    ...(deps.routes || {}),
  };
  ctx.routes = ROUTES;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, notify: notifyEnabled(cfg), leads: await store.count() });
      const route = ROUTES[`${req.method} ${url.pathname}`];
      if (route?.serverToServer) return await route(req, res, '', ctx); // provider webhooks: authenticated by signature, not by browser Origin
      const origin = checkOrigin(req, cfg);
      if (origin === null) return send(res, 403, { ok: false, error: 'Origin not allowed' });
      if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(origin)); return res.end(); }
      if (!route) return send(res, 404, { ok: false, error: 'Not found' }, corsHeaders(origin));
      return await route(req, res, origin, ctx);
    } catch (e) {
      log(`error: ${e.message}`);
      if (!res.headersSent) send(res, 500, { ok: false, error: 'Server error' });
    }
  });

  let timer = null;
  return {
    server, store, ctx, sweep,
    listen: () => new Promise((resolve) => {
      server.listen(cfg.port, cfg.host, () => {
        timer = setInterval(() => sweep().catch((e) => log(`sweep error: ${e.message}`)), cfg.notifySweepMs);
        timer.unref();
        resolve(server.address());
      });
    }),
    close: () => new Promise((resolve) => { if (timer) clearInterval(timer); server.close(async () => { await store.close(); resolve(); }); server.closeAllConnections?.(); }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cfg = loadConfig();
  const api = await createLeadApi(cfg);
  api.listen().then((a) => {
    console.log(`lead-api listening on ${a.address}:${a.port}; origins=${cfg.allowedOrigins.join(',')}; store=${cfg.databaseUrl ? 'postgres' : 'json-file'}; demo=${cfg.demo.enabled && cfg.demo.webhookUrl ? 'on' : 'off'}; payments=${cfg.pay.enabled ? 'on (TEST MODE)' : 'off'}; smtp=${cfg.smtp.host ? 'on' : 'off'}; webhook=${cfg.webhookUrl ? 'on' : 'off'}`);
    if (!notifyEnabled(cfg)) console.warn('WARNING: no notification channel configured (SMTP_HOST+LEAD_NOTIFY_TO or LEAD_WEBHOOK_URL). Leads are stored but nobody is told.');
  });
}
