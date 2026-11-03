import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { demoEndpoint, requestDemoCall } from '../lib/demo-client';

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => ({ ok: status < 300, status, json: async () => body, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } }) as unknown as Response;

describe('requestDemoCall', () => {
  it('posts to the same-origin guard endpoint, never to n8n, with the typed number + country (server normalises)', async () => {
    const f = vi.fn().mockResolvedValue(res(200, { ok: true }));
    const r = await requestDemoCall({ phone: '082 123 4567', country: '+27', leadId: 'abc-123' }, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/demo-call');
    expect(JSON.parse(init.body)).toMatchObject({ phone: '082 123 4567', country: '+27', lead_id: 'abc-123', website: '' });
    expect(String(url)).not.toContain('fourcee.online');
  });
  it('rejects an invalid number locally with no request', async () => {
    const f = vi.fn();
    const r = await requestDemoCall({ phone: '0861234567', country: '+27' }, { fetchImpl: f as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: false, code: 'bad_phone' }); expect(f).not.toHaveBeenCalled();
  });
  it('surfaces server error message + retry-after (429) instead of alert()', async () => {
    const f = vi.fn().mockResolvedValue(res(429, { code: 'rate_ip', error: 'Too many' }, { 'retry-after': '120' }));
    expect(await requestDemoCall({ phone: '0821234567', country: '+27' }, { fetchImpl: f as unknown as typeof fetch })).toEqual({ ok: false, code: 'rate_ip', message: 'Too many', retryAfterSec: 120 });
  });
  it('network failure -> friendly message', async () => {
    const r = await requestDemoCall({ phone: '0821234567', country: '+27' }, { fetchImpl: (async () => { throw new TypeError('x'); }) as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: false, code: 'network' });
  });
  it('endpoint override', () => { expect(demoEndpoint('https://x/api/demo-call')).toBe('https://x/api/demo-call'); });
});

describe('the n8n webhook is not in the browser source', () => {
  it('no component or lib references the n8n webhook host/path', () => {
    for (const f of ['components/ui/mini-phone.tsx', 'lib/demo-client.ts', 'App.tsx', 'components/AuditPage.tsx']) {
      const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/app\.fourcee\.online|voice-demo-request/);
    }
  });
});
