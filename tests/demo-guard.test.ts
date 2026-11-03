import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';

const ORIGIN = 'https://fourcee.lutho.app';
const SECRET = 'n8n-shared-secret-xyz';
let api: Awaited<ReturnType<typeof createLeadApi>> | undefined; let n8n: http.Server; let ts: http.Server; let tmp = '';
let calls: { headers: http.IncomingHttpHeaders; body: any }[] = []; let n8nStatus = 200; let tsResult: any = { success: true }; let tsSeen: string[] = [];
let base = ''; let clock = Date.parse('2026-10-03T10:00:00Z'); let logs: string[] = [];

const listen = (s: http.Server) => new Promise<number>((r) => s.listen(0, '127.0.0.1', () => r((s.address() as { port: number }).port)));
async function boot(env: Record<string, string> = {}, opts: { noN8n?: boolean } = {}) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-guard-'));
  calls = []; n8nStatus = 200; tsResult = { success: true }; tsSeen = []; logs = []; clock = Date.parse('2026-10-03T10:00:00Z');
  n8n = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { calls.push({ headers: req.headers, body: JSON.parse(b || '{}') }); res.writeHead(n8nStatus); res.end('{}'); }); });
  ts = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { tsSeen.push(b); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(tsResult)); }); });
  const n8nPort = await listen(n8n), tsPort = await listen(ts);
  const cfg = loadConfig({ LEAD_PORT: '0', LEAD_DATA_DIR: tmp, LEAD_ALLOWED_ORIGINS: ORIGIN, ...(opts.noN8n ? {} : { N8N_DEMO_WEBHOOK_URL: `http://127.0.0.1:${n8nPort}/webhook/voice-demo-request` }), N8N_DEMO_WEBHOOK_SECRET: SECRET, TURNSTILE_VERIFY_URL: `http://127.0.0.1:${tsPort}/siteverify`, ...env });
  api = await createLeadApi(cfg, { log: (...a: unknown[]) => logs.push(a.join(' ')), now: () => clock });
  const a = await api.listen(); base = `http://127.0.0.1:${(a as any).port}`;
}
function raw(method: string, p: string, headers: Record<string, string>, body?: string) {
  return new Promise<{ status: number; text: string; headers: (n: string) => string | null }>((resolve, reject) => {
    const u = new URL(base + p);
    const r = http.request({ host: u.hostname, port: u.port, path: u.pathname, method, agent: false, headers: { connection: 'close', ...headers, ...(body != null ? { 'content-length': String(Buffer.byteLength(body)) } : {}) } }, (res) => { let t = ''; res.on('data', (c) => (t += c)); res.on('end', () => resolve({ status: res.statusCode || 0, text: t, headers: (n) => (res.headers[n.toLowerCase()] as string) ?? null })); });
    r.on('error', reject); if (body != null) r.write(body); r.end();
  });
}
async function call(body: unknown, headers: Record<string, string> = {}) {
  const r = await raw('POST', '/api/demo-call', { 'content-type': 'application/json', origin: ORIGIN, ...headers }, typeof body === 'string' ? body : JSON.stringify(body));
  let json: any = null; try { json = JSON.parse(r.text); } catch { /* */ }
  return { status: r.status, json, text: r.text, headers: r.headers };
}
afterEach(async () => { if (!api) return; await api.close(); await new Promise((r) => { n8n.close(() => r(null)); n8n.closeAllConnections?.(); }); await new Promise((r) => { ts.close(() => r(null)); ts.closeAllConnections?.(); }); fs.rmSync(tmp, { recursive: true, force: true }); api = undefined; });

describe('demo-call guard: happy path + normalisation', () => {
  it('forwards a SA 0-prefixed number as +27… with the shared secret; browser never needs the n8n URL', async () => {
    await boot();
    const r = await call({ phone: '082 123 4567', country: '+27', lead_id: 'e75f4a82-1111-4222-8333-444455556666' });
    expect(r.status).toBe(200); expect(r.json).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ phone_number: '+27821234567', lead_id: 'e75f4a82-1111-4222-8333-444455556666' });
    expect(calls[0].headers['x-fourcee-secret']).toBe(SECRET);
    expect(r.text).not.toContain('webhook'); expect(r.text).not.toContain(SECRET);
  });
  it('uses the default country when none is sent', async () => {
    await boot();
    await call({ phone: '0821234567' });
    expect(calls[0].body.phone_number).toBe('+27821234567');
  });
  it.each([['abc'], ['12345'], ['0861234567'], ['+999123456789'], [''], ['082 123 4567; rm -rf']])('rejects %j with 400 bad_phone and does not call n8n', async (phone) => {
    await boot();
    const r = await call({ phone });
    expect(r.status).toBe(400); expect(r.json.code).toBe('bad_phone'); expect(calls).toHaveLength(0);
  });
  it('rejects a country that is not on the allow-list', async () => {
    await boot({ DEMO_ALLOWED_COUNTRIES: '+27' });
    expect((await call({ phone: '+44 7700 900123' })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it('rejects odd lead ids, non-json and bad content type', async () => {
    await boot();
    expect((await call({ phone: '0821234567', lead_id: 'x'.repeat(80) })).status).toBe(400);
    expect((await call({ phone: '0821234567', lead_id: '../../etc' })).status).toBe(400);
    expect((await call('{nope')).status).toBe(400);
    expect((await call('x', { 'content-type': 'text/plain' })).status).toBe(415);
    expect(calls).toHaveLength(0);
  });
});

describe('demo-call guard: origin, honeypot, kill switch, do-not-call', () => {
  it('origin allow-list: wrong origin and missing origin are refused; preflight only for allowed', async () => {
    await boot();
    expect((await call({ phone: '0821234567' }, { origin: 'https://evil.example' })).status).toBe(403);
    const none = await raw('POST', '/api/demo-call', { 'content-type': 'application/json' }, JSON.stringify({ phone: '0821234567' }));
    expect(none.status).toBe(403);
    expect((await raw('OPTIONS', '/api/demo-call', { origin: ORIGIN })).status).toBe(204);
    expect((await raw('OPTIONS', '/api/demo-call', { origin: 'https://evil.example' })).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it('honeypot: fake success, nothing forwarded, nothing counted', async () => {
    await boot();
    const r = await call({ phone: '0821234567', website: 'http://spam' });
    expect(r.status).toBe(200); expect(calls).toHaveLength(0);
    expect((api!.ctx.routes['POST /api/demo-call'] as any).state().count).toBe(0);
  });
  it('kill switch DEMO_ENABLED=0 -> 503 paused, and missing webhook URL -> 503', async () => {
    await boot({ DEMO_ENABLED: '0' });
    const r = await call({ phone: '0821234567' });
    expect(r.status).toBe(503); expect(r.json.code).toBe('paused'); expect(calls).toHaveLength(0);
    await api!.close(); api = undefined;
    await boot({}, { noN8n: true });
    expect((await call({ phone: '0821234567' })).json.code).toBe('not_configured');
  });
  it('do-not-call list (env and file) blocks the number', async () => {
    await boot({ DEMO_BLOCKLIST: '+27821230000' });
    expect((await call({ phone: '0821230000' })).status).toBe(403);
    await api!.close(); api = undefined;
    const f = path.join(os.tmpdir(), `dnc-${Date.now()}.txt`); fs.writeFileSync(f, '+27829990000\n');
    await boot({ DEMO_BLOCKLIST_FILE: f });
    expect((await call({ phone: '0829990000' })).json.code).toBe('blocked');
    expect((await call({ phone: '0821110000' })).status).toBe(200);
    fs.rmSync(f);
  });
});

describe('demo-call guard: rate caps', () => {
  it('per-IP hourly cap (3) then 429 with Retry-After; recovers after the window', async () => {
    await boot();
    for (const n of ['0821000001', '0821000002', '0821000003']) expect((await call({ phone: n })).status).toBe(200);
    const r = await call({ phone: '0821000004' });
    expect(r.status).toBe(429); expect(r.json.code).toBe('rate_ip'); expect(Number(r.headers('retry-after'))).toBeGreaterThan(0);
    expect(calls).toHaveLength(3);
    clock += 3600_000 + 1000;
    expect((await call({ phone: '0821000004' })).status).toBe(200);
  });
  it('per-number: 10 min cooldown, then max 2 per day', async () => {
    await boot({ DEMO_PER_IP_PER_HOUR: '50', DEMO_PER_IP_PER_DAY: '50' });
    expect((await call({ phone: '0821234567' })).status).toBe(200);
    const again = await call({ phone: '+27 82 123 4567' }); // same number, different formatting
    expect(again.status).toBe(429); expect(again.json.code).toBe('rate_number');
    clock += 11 * 60_000; expect((await call({ phone: '0821234567' })).status).toBe(200);
    clock += 11 * 60_000; expect((await call({ phone: '0821234567' })).status).toBe(429); // 3rd within 24h
    expect(calls).toHaveLength(2);
    clock += 24 * 3600_000; expect((await call({ phone: '0821234567' })).status).toBe(200);
  });
  it('global daily cap -> 503 daily_cap, resets the next UTC day', async () => {
    await boot({ DEMO_MAX_PER_DAY: '2', DEMO_PER_IP_PER_HOUR: '50', DEMO_PER_IP_PER_DAY: '50' });
    expect((await call({ phone: '0821000001' })).status).toBe(200);
    expect((await call({ phone: '0821000002' })).status).toBe(200);
    const r = await call({ phone: '0821000003' });
    expect(r.status).toBe(503); expect(r.json.code).toBe('daily_cap'); expect(calls).toHaveLength(2);
    clock = Date.parse('2026-10-04T00:05:00Z');
    expect((await call({ phone: '0821000003' })).status).toBe(200);
  });
  it('burst shield: >10 requests a minute from one IP are refused even if invalid', async () => {
    await boot();
    let last = 0; for (let i = 0; i < 12; i++) last = (await call({ phone: 'x' })).status;
    expect(last).toBe(429);
  });
  it('invalid numbers and bots do not burn the daily budget', async () => {
    await boot({ DEMO_MAX_PER_DAY: '1', DEMO_PER_IP_PER_HOUR: '50', DEMO_PER_IP_PER_DAY: '50' });
    await call({ phone: 'abc' }); await call({ phone: '0821000001', website: 'x' });
    expect((await call({ phone: '0821000002' })).status).toBe(200);
  });
});

describe('demo-call guard: upstream failure + logging', () => {
  it('n8n down -> 502 and the daily budget is handed back', async () => {
    await boot({ DEMO_MAX_PER_DAY: '1', DEMO_PER_IP_PER_HOUR: '50', DEMO_PER_IP_PER_DAY: '50' });
    n8nStatus = 500;
    expect((await call({ phone: '0821000001' })).json.code).toBe('upstream');
    n8nStatus = 200;
    expect((await call({ phone: '0821000002' })).status).toBe(200);
  });
  it('logs never contain a full phone number or the secret', async () => {
    await boot();
    await call({ phone: '0821234567' });
    const all = logs.join('\n');
    expect(all).not.toContain('821234567'); expect(all).not.toContain(SECRET); expect(all).toContain('requested');
  });
});

describe('demo-call guard: Turnstile hook', () => {
  it('without TURNSTILE_SECRET the hook is off', async () => {
    await boot();
    expect((await call({ phone: '0821234567' })).status).toBe(200); expect(tsSeen).toHaveLength(0);
  });
  it('with a secret: missing token 403, bad token 403, good token forwarded to the verifier and accepted', async () => {
    await boot({ TURNSTILE_SECRET: 'ts-secret-1', DEMO_PER_IP_PER_HOUR: '50', DEMO_PER_IP_PER_DAY: '50' });
    expect((await call({ phone: '0821000001' })).json.code).toBe('captcha_missing');
    tsResult = { success: false, 'error-codes': ['invalid-input-response'] };
    expect((await call({ phone: '0821000001', turnstile_token: 'bad-token-0123456789' })).json.code).toBe('captcha_failed');
    tsResult = { success: true };
    const ok = await call({ phone: '0821000001', turnstile_token: 'good-token-0123456789' });
    expect(ok.status).toBe(200); expect(calls).toHaveLength(1);
    expect(tsSeen.at(-1)).toContain('secret=ts-secret-1'); expect(tsSeen.at(-1)).toContain('response=good-token-0123456789');
  });
  it('fails closed when the verifier is unreachable', async () => {
    await boot({ TURNSTILE_SECRET: 'ts-secret-1', TURNSTILE_VERIFY_URL: 'http://127.0.0.1:1/siteverify' });
    const r = await call({ phone: '0821000001', turnstile_token: 'good-token-0123456789' });
    expect(r.status).toBe(403); expect(r.json.code).toBe('captcha_unavailable'); expect(calls).toHaveLength(0);
  });
  it('a failed captcha does not consume the per-number budget', async () => {
    await boot({ TURNSTILE_SECRET: 'ts-secret-1' });
    tsResult = { success: false };
    await call({ phone: '0821000001', turnstile_token: 'bad-token-0123456789' });
    tsResult = { success: true };
    expect((await call({ phone: '0821000001', turnstile_token: 'good-token-0123456789' })).status).toBe(200);
  });
});
