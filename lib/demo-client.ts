/**
 * Demo-call client. The browser talks ONLY to our own guard endpoint (server/lead-api POST /api/demo-call, default same-origin);
 * the n8n webhook URL and its secret live on the server. Validation here is for UX; the server re-checks everything.
 */
import { normalizePhone } from './phone';

const envDemoEndpoint = (): string => ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_DEMO_ENDPOINT || '').trim();
export const demoEndpoint = (override?: string) => (override ?? envDemoEndpoint()) || '/api/demo-call';
export const turnstileSiteKey = (): string => ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_TURNSTILE_SITE_KEY || '').trim();

export type DemoResult = { ok: true } | { ok: false; code: string; message: string; retryAfterSec?: number };

export interface DemoRequest { phone: string; country: string; leadId?: string; website?: string; turnstileToken?: string }

export async function requestDemoCall(r: DemoRequest, o: { endpoint?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<DemoResult> {
  const check = normalizePhone(r.phone, { defaultCountry: r.country });
  if (check.ok === false) return { ok: false, code: 'bad_phone', message: check.reason };
  const f = o.fetchImpl ?? fetch;
  try {
    const res = await f(demoEndpoint(o.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: r.phone, country: r.country, lead_id: r.leadId || null, website: r.website || '', turnstile_token: r.turnstileToken || undefined }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 15000),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    const retry = Number(res.headers?.get?.('retry-after')) || undefined;
    return { ok: false, code: j.code || `http_${res.status}`, message: j.error || 'We could not start the call. Please try again.', retryAfterSec: retry };
  } catch {
    return { ok: false, code: 'network', message: 'We could not reach the server. Check your connection and try again.' };
  }
}
