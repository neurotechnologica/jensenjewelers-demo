import { describe, expect, it } from 'vitest';
import { checkoutBase, fetchPayOptions, fetchPayStatus, parsePayReturn, startCheckout } from '../lib/checkout-client';

const resp = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ID = '123e4567-e89b-42d3-a456-426614174000';

describe('checkout client', () => {
  it('defaults to same-origin /api/checkout, override trims a trailing slash', () => {
    expect(checkoutBase()).toBe('/api/checkout');
    expect(checkoutBase('https://x.test/api/checkout/')).toBe('https://x.test/api/checkout');
  });
  it('options: off on server error / network error, parsed when on', async () => {
    expect((await fetchPayOptions({ fetchImpl: resp(500, {}) as any })).enabled).toBe(false);
    expect((await fetchPayOptions({ fetchImpl: (async () => { throw new Error('down'); }) as any })).enabled).toBe(false);
    const on = await fetchPayOptions({ fetchImpl: resp(200, { enabled: true, choices: [{ provider: 'stripe', label: 'Card', currency: 'USD' }] }) as any });
    expect(on.enabled).toBe(true); expect(on.choices).toHaveLength(1);
  });
  it('start: sends lead id/provider/currency and NEVER an amount', async () => {
    let sent: any;
    const f = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ url: 'https://pay.example/x' }), { status: 200 }); }) as any;
    const r = await startCheckout(ID, { provider: 'stripe', currency: 'USD' }, { fetchImpl: f });
    expect(r).toEqual({ ok: true, url: 'https://pay.example/x' });
    expect(Object.keys(sent).sort()).toEqual(['currency', 'lead_id', 'provider']);
  });
  it('start: refuses non-http(s) urls and surfaces the server message', async () => {
    expect((await startCheckout(ID, { provider: 's', currency: 'USD' }, { fetchImpl: resp(200, { url: 'javascript:alert(1)' }) as any })).ok).toBe(false);
    const r: any = await startCheckout(ID, { provider: 's', currency: 'USD' }, { fetchImpl: resp(503, { code: 'payments_off', error: 'Online payment is not available right now.' }) as any });
    expect(r).toMatchObject({ ok: false, code: 'payments_off', message: 'Online payment is not available right now.' });
    expect(((await startCheckout(ID, { provider: 's', currency: 'USD' }, { fetchImpl: (async () => { throw new Error('x'); }) as any })) as any).code).toBe('network');
  });
  it('status + return-url parsing', async () => {
    expect(await fetchPayStatus(ID, { fetchImpl: resp(200, { paymentStatus: 'paid' }) as any })).toBe('paid');
    expect(await fetchPayStatus(ID, { fetchImpl: resp(404, {}) as any })).toBe('unknown');
    expect(parsePayReturn(`?pay=success&lead=${ID}`)).toEqual({ result: 'success', leadId: ID });
    expect(parsePayReturn(`?pay=cancel&lead=${ID}`)?.result).toBe('cancel');
    expect(parsePayReturn('?pay=success&lead=nope')).toBeNull();
    expect(parsePayReturn('?pay=hacked&lead=' + ID)).toBeNull();
  });
});
