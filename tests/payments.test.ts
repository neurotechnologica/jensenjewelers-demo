import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';
import { startMockProviders } from '../server/lead-api/dev/mock-providers.mjs';
import { PLANS, UPSELLS, quoteUsd, priceFor } from '../server/lead-api/lib/pricing.mjs';
import { signStripe } from '../server/lead-api/lib/payments/stripe.mjs';
import { signPaystack } from '../server/lead-api/lib/payments/paystack.mjs';
import { UPSELL_IDS } from '../server/lead-api/lib/validate.mjs';

const ORIGIN = 'https://fourcee.lutho.app';
const WHSEC = 'whsec_test_unit';
const PSK = 'sk_test_paystack_unit';
const SSK = 'sk_test_stripe_unit';

describe('pricing mirrors the site catalog (constants.tsx)', () => {
  const src = fs.readFileSync('constants.tsx', 'utf8');
  it('plan prices match', () => {
    for (const [id, p] of Object.entries(PLANS)) {
      const block = src.slice(src.indexOf(`id: '${id}'`));
      expect(block.match(/price: (\d+)/)![1], id).toBe(String(p.setup));
      expect(block.match(/monthly: (\d+)/)![1], id).toBe(String(p.monthly));
      expect(block.match(/yearlyPrice: (\d+)/)![1], id).toBe(String(p.yearly));
    }
  });
  it('add-on prices and ids match', () => {
    expect(UPSELL_IDS).toEqual(Object.keys(UPSELLS));
    expect(src).toMatch(/id: 'white_glove_onboarding'[\s\S]*?price: 1500/);
    expect(src).toMatch(/id: 'extra_location_pack'[\s\S]*?monthlyPrice: 399/);
  });
  it('quote: monthly = setup + first month (+ add-ons), annual = yearly with setup waived', () => {
    expect(quoteUsd({ plan: 'pro', billing_cycle: 'monthly' })!.usd).toBe(5997);
    expect(quoteUsd({ plan: 'pro', billing_cycle: 'annual' })!.usd).toBe(9564);
    expect(quoteUsd({ plan: 'starter', billing_cycle: 'monthly', upsells: ['white_glove_onboarding', 'extra_location_pack', 'nope'] })!.usd).toBe(2500 + 497 + 399 + 1500);
    expect(quoteUsd({ plan: 'nope', billing_cycle: 'monthly' })).toBeNull();
  });
  it('ZAR needs an owner-set rate and is rounded to whole rand; limits apply', () => {
    const lead = { plan: 'pro', billing_cycle: 'monthly' };
    const cfg = (rate: number) => ({ pay: { zarPerUsd: rate, maxMinor: 100_000_000 } });
    expect(priceFor(lead, 'ZAR', cfg(0))).toEqual({ error: 'zar_not_configured' });
    expect(priceFor(lead, 'ZAR', cfg(18.5))).toMatchObject({ amountMinor: 11094500, currency: 'ZAR' }); // 5997 * 18.5 = 110944.5 -> R110 945
    expect(priceFor(lead, 'USD', cfg(0))).toMatchObject({ amountMinor: 599700, currency: 'USD' });
    expect(priceFor(lead, 'EUR', cfg(18.5))).toEqual({ error: 'unsupported_currency' });
    expect(priceFor(lead, 'USD', { pay: { zarPerUsd: 0, maxMinor: 1000 } })).toEqual({ error: 'amount_out_of_range' });
  });
});

describe('live keys are refused', () => {
  const boot = (env: Record<string, string>) => createLeadApi(loadConfig({ LEAD_PORT: '0', LEAD_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'pay-live-')), ...env }), { log: () => {} });
  it.each([
    ['sk_live_abc123', 'STRIPE_SECRET_KEY'], ['rk_live_abc123', 'STRIPE_SECRET_KEY'], ['pk_test_abc', 'STRIPE_SECRET_KEY'], ['whatever', 'STRIPE_SECRET_KEY'],
    ['sk_live_abc123', 'PAYSTACK_SECRET_KEY'], ['sk_test_live_trick', 'PAYSTACK_SECRET_KEY'],
  ])('%s as %s => server will not start (even with PAYMENTS_ENABLED=0)', async (key, name) => {
    await expect(boot({ [name]: key })).rejects.toThrow(/TEST key/);
  });
  it('test keys are accepted', async () => {
    const api = await boot({ STRIPE_SECRET_KEY: 'sk_test_ok', PAYSTACK_SECRET_KEY: 'sk_test_ok' });
    await api.close();
  });
});

type Rig = { api: any; base: string; mock: Awaited<ReturnType<typeof startMockProviders>>; dir: string; hooks: { body: string }[]; hookSrv: http.Server };
let rig: Rig | undefined;
async function boot(env: Record<string, string> = {}, opts: { mockStripeKey?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pay-'));
  const hooks: { body: string }[] = [];
  const hookSrv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hooks.push({ body: b }); res.writeHead(200); res.end('{}'); }); });
  await new Promise<void>((r) => hookSrv.listen(0, '127.0.0.1', () => r()));
  // the API needs the mock's port and the mock needs the API's port: create the API first on a fixed free port
  const probe = http.createServer(); await new Promise<void>((r) => probe.listen(0, '127.0.0.1', () => r())); const apiPort = (probe.address() as any).port; await new Promise((r) => probe.close(r));
  const mock = await startMockProviders({ webhookBase: `http://127.0.0.1:${apiPort}`, stripeWebhookSecret: WHSEC, paystackSecret: PSK, stripeKey: opts.mockStripeKey ?? SSK, paystackKey: PSK });
  const cfg = loadConfig({
    LEAD_PORT: String(apiPort), LEAD_DATA_DIR: dir, LEAD_ALLOWED_ORIGINS: ORIGIN, LEAD_WEBHOOK_URL: `http://127.0.0.1:${(hookSrv.address() as any).port}/h`, LEAD_RATE_PER_MIN: '100', LEAD_RATE_PER_HOUR: '1000', LEAD_MAX_PER_DAY_PER_IP: '1000',
    PAYMENTS_ENABLED: '1', PAY_ZAR_PER_USD: '18.5', STRIPE_SECRET_KEY: SSK, STRIPE_WEBHOOK_SECRET: WHSEC, PAYSTACK_SECRET_KEY: PSK, STRIPE_API_BASE: mock.base, PAYSTACK_API_BASE: mock.base, ...env,
  });
  const api = await createLeadApi(cfg, { log: () => {} });
  await api.listen();
  rig = { api, base: `http://127.0.0.1:${apiPort}`, mock, dir, hooks, hookSrv };
  return rig;
}
afterEach(async () => { if (!rig) return; await rig.api.close(); await rig.mock.close(); await new Promise((r) => { rig!.hookSrv.close(() => r(null)); rig!.hookSrv.closeAllConnections?.(); }); fs.rmSync(rig.dir, { recursive: true, force: true }); rig = undefined; });

function call(method: string, p: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const u = new URL(rig!.base + p);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { connection: 'close', ...headers, ...(body != null ? { 'content-length': String(Buffer.byteLength(body)) } : {}) }, agent: false }, (res) => {
      let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => { let j: any = null; try { j = JSON.parse(t); } catch { /* */ } resolve({ status: res.statusCode || 0, json: j }); });
    });
    r.on('error', reject); if (body != null) r.write(body); r.end();
  });
}
const J = { 'content-type': 'application/json', origin: ORIGIN };
const mkLead = async (o: Record<string, unknown> = {}) => (await call('POST', '/api/lead', J, JSON.stringify({ name: 'Zoe Test', email: 'zoe@testco.example', store: 'Test & Co Jewellers', plan: 'pro', billing_cycle: 'monthly', total: 1, currency: 'USD', idempotency_key: crypto.randomUUID(), ...o }))).json.id as string;
const checkout = (body: unknown, headers: Record<string, string> = J) => call('POST', '/api/checkout', headers, JSON.stringify(body));
const lead = (id: string) => rig!.api.store.get(id);
const hookStripe = (body: object, secret = WHSEC, t?: number) => { const raw = JSON.stringify(body); return call('POST', '/api/pay/webhook/stripe', { 'content-type': 'application/json', 'stripe-signature': signStripe(raw, secret, t) }, raw); };
const stripeEvt = (id: string, sessionRef: string, leadId: string, o: Record<string, unknown> = {}) => ({ id, type: 'checkout.session.completed', data: { object: { id: sessionRef, client_reference_id: leadId, payment_status: 'paid', amount_total: 599700, currency: 'usd', ...o } } });
async function payAtMock(url: string) { const u = new URL(url); const r = await fetch(`${u.origin}${u.pathname}/complete`, { method: 'POST', redirect: 'manual', headers: { connection: 'close' } }); return r.status; }

describe('checkout creation (server-side, test mode)', () => {
  it('options list enabled providers; no secrets; USD+ZAR', async () => {
    await boot();
    const r = await call('GET', '/api/checkout/options', { origin: ORIGIN });
    expect(r.json.enabled).toBe(true); expect(r.json.mode).toBe('test');
    expect(r.json.choices.map((c: any) => `${c.provider}:${c.currency}`).sort()).toEqual(['paystack:ZAR', 'stripe:USD', 'stripe:ZAR']);
    expect(JSON.stringify(r.json)).not.toMatch(/sk_test|whsec/);
  });
  it('charges the SERVER price; client-supplied amounts are ignored', async () => {
    await boot();
    const id = await mkLead({ total: 1 }); // browser claims a $1 total
    const r = await checkout({ lead_id: id, provider: 'stripe', currency: 'USD', amount: 1, total: 1, amount_minor: 100 });
    expect(r.status).toBe(200); expect(r.json.mode).toBe('test'); expect(r.json.url).toContain(rig!.mock.base);
    const created = rig!.mock.calls.find((c: any) => c.kind === 'stripe-create');
    expect(created.form['line_items[0][price_data][unit_amount]']).toBe('599700'); // pro: $5,000 setup + $997
    expect(created.form['line_items[0][price_data][currency]']).toBe('usd');
    expect(created.form.client_reference_id).toBe(id);
    expect(created.headers.authorization).toBe(`Bearer ${SSK}`);
    expect(created.form.success_url).toContain(`lead=${id}`);
    const l = await lead(id);
    expect(l.paymentStatus).toBe('pending'); expect(l.payment).toMatchObject({ mode: 'test', provider: 'stripe', amountMinor: 599700, currency: 'USD', status: 'pending' });
  });
  it('add-ons stored on the lead are priced; unknown add-ons dropped', async () => {
    await boot();
    const id = await mkLead({ plan: 'starter', upsells: ['white_glove_onboarding', 'bogus'] });
    expect((await lead(id)).upsells).toEqual(['white_glove_onboarding']);
    await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    expect((await lead(id)).payment.amountMinor).toBe((2500 + 497 + 1500) * 100);
  });
  it('ZAR via Paystack uses the owner rate (whole rand) and is sent in cents', async () => {
    await boot();
    const id = await mkLead();
    const r = await checkout({ lead_id: id, provider: 'paystack', currency: 'ZAR' });
    expect(r.status).toBe(200);
    const init = rig!.mock.calls.find((c: any) => c.kind === 'paystack-init');
    expect(init.body).toMatchObject({ amount: 11094500, currency: 'ZAR', email: 'zoe@testco.example', metadata: { lead_id: id } });
  });
  it('ZAR refused (503) until the owner sets PAY_ZAR_PER_USD; no rand price is invented', async () => {
    await boot({ PAY_ZAR_PER_USD: '' });
    const id = await mkLead();
    const r = await checkout({ lead_id: id, provider: 'paystack', currency: 'ZAR' });
    expect(r.status).toBe(503); expect(r.json.code).toBe('zar_not_configured');
    expect((await call('GET', '/api/checkout/options', { origin: ORIGIN })).json.choices.map((c: any) => c.currency)).not.toContain('ZAR');
    expect(rig!.mock.calls.filter((c: any) => c.kind !== 'webhook-out')).toHaveLength(0);
  });
  it('payments off by default => 503, nothing contacted', async () => {
    await boot({ PAYMENTS_ENABLED: '0' });
    const id = await mkLead();
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' })).status).toBe(503);
    expect((await call('GET', '/api/checkout/options', { origin: ORIGIN })).json.enabled).toBe(false);
    expect(rig!.mock.calls).toHaveLength(0);
  });
  it('bad lead id, unknown lead, bad provider, disallowed Origin', async () => {
    await boot();
    expect((await checkout({ lead_id: 'nope', provider: 'stripe' })).status).toBe(400);
    expect((await checkout({ lead_id: crypto.randomUUID(), provider: 'stripe' })).status).toBe(404);
    const id = await mkLead();
    expect((await checkout({ lead_id: id, provider: 'paypal', currency: 'USD' })).status).toBe(400);
    expect((await checkout({ lead_id: id, provider: 'paystack', currency: 'USD' })).status).toBe(400); // Paystack here is ZAR only
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' }, { 'content-type': 'application/json', origin: 'https://evil.example' })).status).toBe(403);
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' }, { 'content-type': 'application/json' })).status).toBe(403);
  });
  it('provider outage => 502 and the lead stays unpaid', async () => {
    await boot({}, { mockStripeKey: 'sk_test_DIFFERENT' }); // mock rejects our key with 401
    const id = await mkLead();
    const r = await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    expect(r.status).toBe(502); expect(JSON.stringify(r.json)).not.toMatch(/sk_test/);
    expect((await lead(id)).paymentStatus).toBe('unpaid');
  });
  it('per-lead attempt cap', async () => {
    await boot({ PAY_MAX_ATTEMPTS_PER_LEAD: '2', PAY_PER_IP_PER_HOUR: '50' });
    const id = await mkLead();
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' })).status).toBe(200);
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' })).status).toBe(200);
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' })).status).toBe(429);
  });
});

describe('webhooks: signature, idempotency, amount check', () => {
  it('end to end through the mock hosted page: Stripe paid, owner told, status endpoint', async () => {
    await boot();
    const id = await mkLead();
    const { json } = await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    expect((await call('GET', `/api/checkout/status?lead_id=${id}`, { origin: ORIGIN })).json.paymentStatus).toBe('pending');
    expect(await payAtMock(json.url)).toBe(303);
    const l = await lead(id);
    expect(l.paymentStatus).toBe('paid'); expect(l.payment).toMatchObject({ status: 'paid', amountMinor: 599700, currency: 'USD', provider: 'stripe' }); expect(l.payment.paidAt).toBeTruthy();
    expect((await call('GET', `/api/checkout/status?lead_id=${id}`, { origin: ORIGIN })).json.paymentStatus).toBe('paid');
    await new Promise((r) => setTimeout(r, 100));
    expect(rig!.hooks.some((h) => h.body.includes('payment.received') && h.body.includes('"mode":"test"'))).toBe(true);
    expect((await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' })).status).toBe(409); // cannot pay twice
  });
  it('end to end: Paystack ZAR paid', async () => {
    await boot();
    const id = await mkLead();
    const { json } = await checkout({ lead_id: id, provider: 'paystack', currency: 'ZAR' });
    await payAtMock(json.url);
    expect(await lead(id)).toMatchObject({ paymentStatus: 'paid', payment: { provider: 'paystack', amountMinor: 11094500, currency: 'ZAR' } });
  });
  it('webhooks need no browser Origin (the signature is the auth)', async () => {
    await boot();
    const id = await mkLead();
    const { json } = await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref;
    expect(json.url).toContain(ref);
    expect((await hookStripe(stripeEvt('evt_1', ref, id))).status).toBe(200);
    expect((await lead(id)).paymentStatus).toBe('paid');
  });
  it.each([
    ['wrong secret', () => ({ secret: 'whsec_wrong' })],
    ['stale timestamp', () => ({ t: Math.floor(Date.now() / 1000) - 3600 })],
    ['future timestamp', () => ({ t: Math.floor(Date.now() / 1000) + 3600 })],
  ])('Stripe: %s => 400, lead not paid', async (_n, mk) => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref; const o: any = mk();
    expect((await hookStripe(stripeEvt('evt_x', ref, id), o.secret || WHSEC, o.t)).status).toBe(400);
    expect((await lead(id)).paymentStatus).toBe('pending');
  });
  it('Stripe: missing / malformed / tampered body signature => 400', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref; const raw = JSON.stringify(stripeEvt('evt_t', ref, id));
    expect((await call('POST', '/api/pay/webhook/stripe', { 'content-type': 'application/json' }, raw)).status).toBe(400);
    expect((await call('POST', '/api/pay/webhook/stripe', { 'stripe-signature': 'garbage' }, raw)).status).toBe(400);
    const sig = signStripe(raw, WHSEC);
    expect((await call('POST', '/api/pay/webhook/stripe', { 'stripe-signature': sig }, raw.replace('599700', '1'))).status).toBe(400); // body changed after signing
    expect((await lead(id)).paymentStatus).toBe('pending');
  });
  it('Paystack: bad / missing signature => 400; good signature => paid', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'paystack', currency: 'ZAR' });
    const ref = (await lead(id)).payment.ref;
    const raw = JSON.stringify({ event: 'charge.success', data: { id: 9, reference: ref, status: 'success', amount: 11094500, currency: 'ZAR', metadata: { lead_id: id } } });
    expect((await call('POST', '/api/pay/webhook/paystack', {}, raw)).status).toBe(400);
    expect((await call('POST', '/api/pay/webhook/paystack', { 'x-paystack-signature': signPaystack(raw, 'sk_test_other') }, raw)).status).toBe(400);
    expect((await lead(id)).paymentStatus).toBe('pending');
    expect((await call('POST', '/api/pay/webhook/paystack', { 'x-paystack-signature': signPaystack(raw, PSK) }, raw)).status).toBe(200);
    expect((await lead(id)).paymentStatus).toBe('paid');
  });
  it('a redelivered event is a no-op (idempotent) and does not re-notify', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref;
    expect((await hookStripe(stripeEvt('evt_dup', ref, id))).status).toBe(200);
    const paidAt = (await lead(id)).payment.paidAt;
    await new Promise((r) => setTimeout(r, 50));
    const before = rig!.hooks.filter((h) => h.body.includes('payment.received')).length;
    const again = await hookStripe(stripeEvt('evt_dup', ref, id));
    expect(again.json.duplicate).toBe(true);
    expect((await lead(id)).payment.paidAt).toBe(paidAt);
    await new Promise((r) => setTimeout(r, 50));
    expect(rig!.hooks.filter((h) => h.body.includes('payment.received')).length).toBe(before);
  });
  it('amount or currency that does not match what we asked for is flagged for review, NOT marked paid', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref;
    expect((await hookStripe(stripeEvt('evt_lo', ref, id, { amount_total: 100 }))).json.flagged).toBe(true);
    const l = await lead(id);
    expect(l.paymentStatus).toBe('review'); expect(l.payment.mismatch).toMatchObject({ amountMinor: 100 });
    const id2 = await mkLead(); await checkout({ lead_id: id2, provider: 'stripe', currency: 'USD' });
    await hookStripe(stripeEvt('evt_cur', (await lead(id2)).payment.ref, id2, { currency: 'zar' }));
    expect((await lead(id2)).paymentStatus).toBe('review');
  });
  it('unknown lead / unknown session / unrelated event types are acknowledged (200) and change nothing', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    expect((await hookStripe(stripeEvt('e1', 'cs_test_unknown', id))).json.ignored).toBe(true);
    expect((await hookStripe(stripeEvt('e2', 'x', crypto.randomUUID()))).json.ignored).toBe(true);
    expect((await hookStripe({ id: 'e3', type: 'customer.created', data: { object: {} } })).json.ignored).toBe(true);
    expect((await hookStripe(stripeEvt('e4', (await lead(id)).payment.ref, id, { payment_status: 'unpaid' }))).json.ignored).toBe(true); // async method not settled yet
    expect((await lead(id)).paymentStatus).toBe('pending');
  });
  it('failed / expired mark the lead unpaid-ish but never undo a paid lead', async () => {
    await boot();
    const id = await mkLead(); await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref;
    await hookStripe({ ...stripeEvt('e_exp', ref, id), type: 'checkout.session.expired' });
    expect((await lead(id)).paymentStatus).toBe('unpaid');
    await hookStripe({ ...stripeEvt('e_fail', ref, id), type: 'checkout.session.async_payment_failed' });
    expect((await lead(id)).paymentStatus).toBe('failed');
    await hookStripe(stripeEvt('e_ok', ref, id));
    expect((await lead(id)).paymentStatus).toBe('paid');
    await hookStripe({ ...stripeEvt('e_late', ref, id), type: 'checkout.session.expired' });
    expect((await lead(id)).paymentStatus).toBe('paid');
  });
  it('a second session that also pays is recorded as duplicatePaid, first payment kept', async () => {
    await boot();
    const id = await mkLead();
    await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' }); const ref1 = (await lead(id)).payment.ref;
    await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' }); const ref2 = (await lead(id)).payment.ref;
    expect(ref2).not.toBe(ref1);
    await hookStripe(stripeEvt('p1', ref1, id)); await hookStripe(stripeEvt('p2', ref2, id));
    const l = await lead(id);
    expect(l.paymentStatus).toBe('paid'); expect(l.payment.ref).toBe(ref1); expect(l.payment.duplicatePaid).toHaveLength(1);
  });
  it('webhooks are 503 when payments are off', async () => {
    await boot({ PAYMENTS_ENABLED: '0' });
    expect((await hookStripe(stripeEvt('e', 'x', crypto.randomUUID()))).status).toBe(503);
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('payment state in PostgreSQL (same repository interface)', () => {
  it('create session -> signed webhook -> paid, read back from the database', async () => {
    await boot({ DATABASE_URL: process.env.TEST_DATABASE_URL! });
    const id = await mkLead();
    await checkout({ lead_id: id, provider: 'stripe', currency: 'USD' });
    const ref = (await lead(id)).payment.ref;
    expect((await hookStripe(stripeEvt('evt_pg_' + id, ref, id))).status).toBe(200);
    const l = await lead(id);
    expect(l.paymentStatus).toBe('paid');
    expect(l.payment).toMatchObject({ status: 'paid', amountMinor: 599700, currency: 'USD', provider: 'stripe', mode: 'test' });
    const row = (await (rig!.api.store as any).q('SELECT payment_status, extra->\'payment\'->>\'ref\' AS ref FROM leads WHERE id = $1', [id])).rows[0];
    expect(row).toEqual({ payment_status: 'paid', ref });
  });
});
