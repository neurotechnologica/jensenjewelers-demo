import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';
import { startMailCatcher } from '../server/lead-api/dev/mail-catcher.mjs';
import { validateLead } from '../server/lead-api/lib/validate.mjs';
import { RateLimiter } from '../server/lead-api/lib/ratelimit.mjs';

const ORIGIN = 'https://fourcee.lutho.app';
const good = (o: Record<string, unknown> = {}) => ({ name: 'Zoe Test', email: 'zoe@testco.example', phone: '+27 82 123 4567', store: 'Test & Co Jewellers', plan: 'pro', billing_cycle: 'monthly', notes: 'Call after 3pm', total: 5997, currency: 'USD', idempotency_key: crypto.randomUUID(), ...o });

let tmp: string; let api: Awaited<ReturnType<typeof createLeadApi>> | undefined; let base = ''; let mail: Awaited<ReturnType<typeof startMailCatcher>>;
let hook: http.Server; let hookPort = 0; let hookCalls: { headers: http.IncomingHttpHeaders; body: string }[] = []; let hookStatus = 200;

async function boot(env: Record<string, string> = {}) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-api-'));
  mail = await startMailCatcher();
  hookCalls = []; hookStatus = 200;
  hook = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hookCalls.push({ headers: req.headers, body: b }); res.writeHead(hookStatus); res.end('{}'); }); });
  await new Promise<void>((r) => hook.listen(0, '127.0.0.1', () => r()));
  hookPort = (hook.address() as { port: number }).port;
  const cfg = loadConfig({ LEAD_PORT: '0', LEAD_DATA_DIR: tmp, LEAD_ALLOWED_ORIGINS: ORIGIN, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(mail.port), SMTP_SECURE: 'none', SMTP_FROM: 'Fourcee <leads@fourcee.test>', LEAD_NOTIFY_TO: 'owner@fourcee.test', LEAD_WEBHOOK_URL: `http://127.0.0.1:${hookPort}/hook`, LEAD_WEBHOOK_SECRET: 's3cret', ...env });
  api = await createLeadApi(cfg, { log: () => {} });
  const a = await api.listen();
  base = `http://127.0.0.1:${a.port}`;
}
// node:http with agent:false (fetch/undici pools sockets per host:port and ports get reused between the servers booted by each test)
function raw(method: string, path: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; text: string; headers: { get(n: string): string | null } }>((resolve, reject) => {
    const u = new URL(base + path);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, headers: { connection: 'close', ...headers, ...(body != null ? { 'content-length': String(Buffer.byteLength(body)) } : {}) }, agent: false }, (res) => {
      let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve({ status: res.statusCode || 0, text: t, headers: { get: (n) => (res.headers[n.toLowerCase()] as string) ?? null } }));
    });
    r.on('error', reject); if (body != null) r.write(body); r.end();
  });
}
async function post(body: unknown, headers: Record<string, string> = {}, path = '/api/lead') {
  const r = await raw('POST', path, { 'content-type': 'application/json', origin: ORIGIN, ...headers }, typeof body === 'string' ? body : JSON.stringify(body));
  let json: any = null; try { json = JSON.parse(r.text); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers };
}
const until = async (fn: () => boolean, ms = 3000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 20)); };

afterEach(async () => { if (!api) return; await api.close(); await mail.close(); await new Promise((r) => { hook.close(() => r(null)); hook.closeAllConnections?.(); }); fs.rmSync(tmp, { recursive: true, force: true }); api = undefined; });

describe('validateLead', () => {
  it('accepts a good lead and normalises', () => {
    const v = validateLead(good({ email: ' ZOE@TestCo.example ' }));
    expect(v.ok).toBe(true);
    expect(v.value.email).toBe('zoe@testco.example');
  });
  it.each([
    [{ name: '' }, 'name'], [{ name: 'A' }, 'name'], [{ email: 'nope' }, 'email'], [{ email: 'a@b' }, 'email'], [{ email: 'a..b@c.com' }, 'email'], [{ store: '' }, 'store'],
    [{ phone: 'abc' }, 'phone'], [{ phone: '123' }, 'phone'], [{ plan: '' }, 'plan'], [{ billing_cycle: 'weekly' }, 'billing_cycle'], [{ total: -1 }, 'total'], [{ idempotency_key: 'x' }, 'idempotency_key'],
  ])('rejects %j', (patch, field) => {
    const v = validateLead(good(patch));
    expect(v.ok).toBe(false);
    expect(Object.keys(v.errors)).toContain(field);
  });
  it('strips CR/LF from single-line fields (header injection)', () => {
    const v = validateLead(good({ name: 'Zoe\r\nBcc: evil@x.com', store: 'Shop\nX' }));
    expect(v.ok).toBe(true);
    expect(v.value.name).not.toMatch(/[\r\n]/);
    expect(v.value.store).not.toMatch(/[\r\n]/);
  });
  it('rejects non-object bodies', () => { expect(validateLead(null).ok).toBe(false); expect(validateLead([]).ok).toBe(false); });
});

describe('RateLimiter', () => {
  it('limits per window and recovers', () => {
    let t = 0; const rl = new RateLimiter([{ ms: 1000, max: 2 }], () => t);
    expect(rl.take('a').ok).toBe(true); expect(rl.take('a').ok).toBe(true);
    const x = rl.take('a'); expect(x.ok).toBe(false); expect(x.retryAfterSec).toBe(1);
    expect(rl.take('b').ok).toBe(true);
    t = 1001; expect(rl.take('a').ok).toBe(true);
  });
});

describe('lead API', () => {
  beforeEach(async () => { await boot(); });

  it('stores the lead, then emails + webhooks the owner', async () => {
    const r = await post(good());
    expect(r.status).toBe(201); expect(r.json.ok).toBe(true);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    await until(() => mail.messages.length > 0 && hookCalls.length > 0);
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'leads.json'), 'utf8'));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Zoe Test', email: 'zoe@testco.example', phone: '+27 82 123 4567', store: 'Test & Co Jewellers', plan: 'pro', notes: 'Call after 3pm', paymentStatus: 'unpaid' });
    expect(saved[0].ipHash).toHaveLength(16); expect(JSON.stringify(saved)).not.toContain('127.0.0.1');
    expect(mail.messages[0].to).toEqual(['owner@fourcee.test']);
    const m = mail.decode(mail.messages[0]);
    expect(m.subject).toContain('Test & Co Jewellers'); expect(m.text).toContain('zoe@testco.example'); expect(m.text).toContain('Call after 3pm');
    const h = hookCalls[0];
    expect(h.headers['x-fourcee-signature']).toBe('sha256=' + crypto.createHmac('sha256', 's3cret').update(h.body).digest('hex'));
    expect(JSON.parse(h.body).lead.email).toBe('zoe@testco.example');
    await until(() => (api!.store as any).items[0].notify.done);
    expect((api!.store as any).items[0].notify).toMatchObject({ email: 'sent', webhook: 'sent', done: true });
  });

  it('refuses unknown origins, missing origin, and answers preflight only for allowed origins', async () => {
    expect((await post(good(), { origin: 'https://evil.example' })).status).toBe(403);
    const noOrigin = await raw('POST', '/api/lead', { 'content-type': 'application/json' }, JSON.stringify(good()));
    expect(noOrigin.status).toBe(403);
    const pre = await raw('OPTIONS', '/api/lead', { origin: ORIGIN, 'access-control-request-method': 'POST' });
    expect(pre.status).toBe(204); expect(pre.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const bad = await raw('OPTIONS', '/api/lead', { origin: 'https://evil.example' });
    expect(bad.status).toBe(403);
    expect((api!.store as any).items).toHaveLength(0);
  });

  it('honeypot: looks successful but stores and notifies nothing', async () => {
    const r = await post(good({ website: 'http://spam.example' }));
    expect(r.status).toBe(200); expect(r.json.ok).toBe(true);
    await new Promise((x) => setTimeout(x, 150));
    expect((api!.store as any).items).toHaveLength(0); expect(mail.messages).toHaveLength(0); expect(hookCalls).toHaveLength(0);
  });

  it('validation errors -> 400 with per-field messages, nothing stored', async () => {
    const r = await post(good({ email: 'bad', name: '' }));
    expect(r.status).toBe(400); expect(Object.keys(r.json.fields).sort()).toEqual(['email', 'name']);
    expect((api!.store as any).items).toHaveLength(0);
  });

  it('idempotency key: a retry does not create a duplicate lead or a second email', async () => {
    const body = good();
    const a = await post(body); const b = await post(body);
    expect(a.status).toBe(201); expect(b.status).toBe(200); expect(b.json.duplicate).toBe(true); expect(b.json.id).toBe(a.json.id);
    await until(() => mail.messages.length > 0);
    await new Promise((x) => setTimeout(x, 100));
    expect((api!.store as any).items).toHaveLength(1); expect(mail.messages).toHaveLength(1);
  });

  it('rejects bad content-type, bad JSON and oversize bodies', async () => {
    expect((await post('x', { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post('{nope')).status).toBe(400);
    expect((await post(JSON.stringify({ ...good(), notes: 'x'.repeat(40000) }))).status).toBe(413);
  });

  it('email header injection via name/store cannot add headers', async () => {
    await post(good({ name: 'Zoe\r\nBcc: evil@x.com', store: 'Shop\r\nX-Evil: 1' }));
    await until(() => mail.messages.length > 0);
    const headers = mail.messages[0].raw.split('\r\n\r\n')[0];
    expect(headers).not.toMatch(/^Bcc:/mi); expect(headers).not.toMatch(/^X-Evil:/mi);
    expect(mail.messages[0].to).toEqual(['owner@fourcee.test']);
  });

  it('unknown route 404, health ok without origin', async () => {
    expect((await post(good(), {}, '/api/nope')).status).toBe(404);
    const h = JSON.parse((await raw('GET', '/api/health', {})).text);
    expect(h).toMatchObject({ ok: true, notify: true });
  });
});

describe('lead API limits + failure handling', () => {
  it('per-IP rate limit -> 429 with Retry-After', async () => {
    await boot({ LEAD_RATE_PER_MIN: '2' });
    expect((await post(good())).status).toBe(201); expect((await post(good())).status).toBe(201);
    const r = await post(good());
    expect(r.status).toBe(429); expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((api!.store as any).items).toHaveLength(2);
  });

  it('global daily cap -> 503', async () => {
    await boot({ LEAD_MAX_PER_DAY: '1' });
    expect((await post(good())).status).toBe(201);
    expect((await post(good())).status).toBe(503);
  });

  it('SMTP down: lead is still stored (201) and the sweep retries until the mail arrives', async () => {
    await boot();
    await mail.close();
    const dead = await startMailCatcher({ failFirst: 1 }); // 1st DATA gets 451, then OK
    api!.ctx.cfg.smtp.port = dead.port;
    const r = await post(good());
    expect(r.status).toBe(201);
    await until(() => (api!.store as any).items[0].notify.email === 'failed');
    expect((api!.store as any).items[0].notify.done).toBe(false);
    expect(dead.messages).toHaveLength(0);
    await api!.sweep();
    expect(dead.messages).toHaveLength(1);
    expect((api!.store as any).items[0].notify).toMatchObject({ email: 'sent', done: true });
    const n = await api!.sweep(); expect(n).toBe(0);
    mail = dead;
  });

  it('webhook failing then recovering is retried; email is not re-sent', async () => {
    await boot();
    hookStatus = 500;
    await post(good());
    await until(() => (api!.store as any).items[0]?.notify.webhook === 'failed');
    expect(mail.messages).toHaveLength(1);
    hookStatus = 200;
    await api!.sweep();
    expect((api!.store as any).items[0].notify).toMatchObject({ email: 'sent', webhook: 'sent', done: true });
    expect(mail.messages).toHaveLength(1);
  });

  it('works with no notification channel configured (stores only)', async () => {
    await boot({ SMTP_HOST: '', LEAD_WEBHOOK_URL: '' });
    const r = await post(good());
    expect(r.status).toBe(201);
    await until(() => (api!.store as any).items[0].notify.done);
    expect((api!.store as any).items[0].notify).toMatchObject({ email: 'skipped', webhook: 'skipped' });
  });

  it('optional confirmation email goes to the prospect', async () => {
    await boot({ LEAD_SEND_CONFIRMATION: '1' });
    await post(good());
    await until(() => mail.messages.length >= 2);
    expect(mail.messages.map((m) => m.to[0]).sort()).toEqual(['owner@fourcee.test', 'zoe@testco.example']);
  });

  it('SMTP AUTH works against a catcher that requires it (credentials never in the stored lead)', async () => {
    await boot();
    await mail.close();
    mail = await startMailCatcher({ requireAuth: { user: 'u', pass: 'p-secret' } });
    api!.ctx.cfg.smtp.port = mail.port; api!.ctx.cfg.smtp.user = 'u'; api!.ctx.cfg.smtp.pass = 'p-secret';
    await post(good());
    await until(() => mail.messages.length > 0);
    expect(mail.messages).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmp, 'leads.json'), 'utf8')).not.toContain('p-secret');
  });
});
