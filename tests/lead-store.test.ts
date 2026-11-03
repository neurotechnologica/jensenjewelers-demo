// Repository contract: the SAME behaviour must hold for the JSON-file store and the PostgreSQL store.
// The Postgres run needs a throwaway database: TEST_DATABASE_URL=postgres://user@127.0.0.1:54329/dbname (skipped when unset).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { JsonFileStore, createStore } from '../server/lead-api/lib/store.mjs';
import { PostgresStore, rowToLead } from '../server/lead-api/lib/store-pg.mjs';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';
import { startMailCatcher } from '../server/lead-api/dev/mail-catcher.mjs';

const PG = process.env.TEST_DATABASE_URL || '';
const mk = (o: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: 'Zoe Test', email: 'zoe@testco.example', phone: '+27821234567', store: 'Test & Co Jewellers', plan: 'pro',
  billing_cycle: 'monthly', notes: 'n', crm: '', total: 5997, currency: 'USD', page_url: 'https://x.test/', idempotency_key: crypto.randomUUID(), paymentStatus: 'unpaid',
  ipHash: 'abcd', userAgent: 'ua', notify: { email: 'pending', webhook: 'pending', confirmation: 'pending', attempts: 0, done: false }, ...o,
});

const backends: [string, () => Promise<any>, () => Promise<void>][] = [];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-store-'));
backends.push(['json-file', async () => { const s = new JsonFileStore(path.join(dir, `${crypto.randomUUID()}.json`)); await s.init(); return s; }, async () => {}]);
if (PG) backends.push(['postgres', async () => { const s = new PostgresStore(PG); await s.init(); await s.q('TRUNCATE leads'); return s; }, async () => {}]);
else console.warn('TEST_DATABASE_URL not set: Postgres store tests skipped');

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe.each(backends)('lead store contract: %s', (_name, make) => {
  let s: any;
  beforeAll(async () => { s = await make(); });
  afterAll(async () => { await s.close(); });

  it('add/get round-trips every field', async () => {
    const l = mk(); await s.add(l);
    expect(await s.get(l.id)).toEqual(l);
    expect(await s.get(crypto.randomUUID())).toBeNull();
  });
  it('findByIdempotencyKey', async () => {
    const l = mk(); await s.add(l);
    expect((await s.findByIdempotencyKey(l.idempotency_key))?.id).toBe(l.id);
    expect(await s.findByIdempotencyKey('nope-nope-nope')).toBeNull();
    expect(await s.findByIdempotencyKey(null)).toBeNull();
  });
  it('update merges known and unknown (future module) fields', async () => {
    const l = mk(); await s.add(l);
    const u = await s.update(l.id, { paymentStatus: 'paid', payment: { provider: 'stripe', ref: 'cs_test_1' } });
    expect(u.paymentStatus).toBe('paid'); expect(u.payment).toEqual({ provider: 'stripe', ref: 'cs_test_1' });
    const u2 = await s.update(l.id, { other: 1 });
    expect(u2.payment.ref).toBe('cs_test_1'); expect(u2.other).toBe(1); expect(u2.name).toBe('Zoe Test');
    expect(await s.update(crypto.randomUUID(), { name: 'x' })).toBeNull();
  });
  it('duplicate idempotency key is rejected by the store', async () => {
    const l = mk(); await s.add(l);
    if (_name === 'postgres') await expect(s.add(mk({ idempotency_key: l.idempotency_key }))).rejects.toThrow(); // unique index
  });
  it('countSince and count', async () => {
    const before = await s.count();
    const old = mk({ createdAt: new Date(Date.now() - 3 * 86400000).toISOString() }); await s.add(old); await s.add(mk());
    expect(await s.count()).toBe(before + 2);
    const day = await s.countSince(Date.now() - 86400000);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(await s.countSince(Date.now() - 86400000 * 5)).toBe(day + 1 + (await s.countSince(Date.now() - 86400000 * 5) - day - 1));
  });
  it('pendingNotifications: only unfinished leads under the attempt cap', async () => {
    const pending = mk(); const done = mk({ notify: { attempts: 1, done: true } }); const capped = mk({ notify: { attempts: 6, done: false } });
    await s.add(pending); await s.add(done); await s.add(capped);
    const ids = (await s.pendingNotifications(6)).map((x: any) => x.id);
    expect(ids).toContain(pending.id); expect(ids).not.toContain(done.id); expect(ids).not.toContain(capped.id);
  });
});

describe('createStore', () => {
  it('without DATABASE_URL uses the json file store', async () => {
    const s = await createStore(loadConfig({ LEAD_DATA_DIR: path.join(dir, 'cs') }));
    expect(s).toBeInstanceOf(JsonFileStore);
  });
  it('rowToLead maps columns back and keeps extra', () => {
    const l = rowToLead({ id: 'i', created_at: new Date('2026-01-02T03:04:05Z'), name: 'n', total: '12.50', currency: 'ZAR', payment_status: 'paid', notify: { done: true }, extra: { payment: { ref: 'r' } } });
    expect(l).toMatchObject({ id: 'i', createdAt: '2026-01-02T03:04:05.000Z', total: 12.5, currency: 'ZAR', paymentStatus: 'paid', payment: { ref: 'r' } });
  });
});

describe.skipIf(!PG)('lead API on PostgreSQL (DATABASE_URL)', () => {
  it('stores a lead in Postgres, dedupes by idempotency key, notifies, and survives restart', async () => {
    const mail = await startMailCatcher();
    const env = { LEAD_PORT: '0', DATABASE_URL: PG, LEAD_ALLOWED_ORIGINS: 'https://fourcee.lutho.app', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(mail.port), SMTP_SECURE: 'none', SMTP_FROM: 'a@b.test', LEAD_NOTIFY_TO: 'o@b.test' };
    let api = await createLeadApi(loadConfig(env), { log: () => {} });
    await (api.store as any).q('TRUNCATE leads');
    const a = await api.listen();
    const body = JSON.stringify({ name: 'Zoe Test', email: 'zoe@testco.example', store: 'Test & Co Jewellers', plan: 'pro', phone: '+27821234567', notes: 'hi', idempotency_key: 'pg-key-0001' });
    const post = () => fetch(`http://127.0.0.1:${(a as any).port}/api/lead`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://fourcee.lutho.app', connection: 'close' }, body });
    const r1 = await post(); const r2 = await post();
    expect(r1.status).toBe(201); expect(r2.status).toBe(200);
    for (let i = 0; i < 100 && !mail.messages.length; i++) await new Promise((r) => setTimeout(r, 30));
    expect(mail.messages).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 100));
    await api.close();
    api = await createLeadApi(loadConfig(env), { log: () => {} });
    const rows = await (api.store as any).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Zoe Test', plan: 'pro', paymentStatus: 'unpaid', notify: { email: 'sent', done: true } });
    await api.close(); await mail.close();
  });
});
