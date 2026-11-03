/**
 * Payment client (TEST MODE). The browser asks OUR server (server/lead-api) for a hosted Checkout URL for a lead id and redirects there.
 * It never sends an amount: the server prices the lead. Off unless VITE_PAYMENTS_ENABLED=1 and the server reports payments enabled.
 */
type Env = Record<string, string | undefined>;
const env = (): Env => ((import.meta as ImportMeta & { env?: Env }).env || {});
export const paymentsEnabledInBuild = (): boolean => env().VITE_PAYMENTS_ENABLED === '1';
export const checkoutBase = (override?: string): string => ((override ?? (env().VITE_CHECKOUT_ENDPOINT || '').trim()) || '/api/checkout').replace(/\/$/, '');

export interface PayChoice { provider: string; label: string; currency: string }
export type OptionsResult = { enabled: boolean; mode: 'test'; choices: PayChoice[] };
export type StartResult = { ok: true; url: string } | { ok: false; code: string; message: string };
export type PayStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'review' | 'unknown';

interface Opts { endpoint?: string; fetchImpl?: typeof fetch; timeoutMs?: number }

export async function fetchPayOptions(o: Opts = {}): Promise<OptionsResult> {
  const off: OptionsResult = { enabled: false, mode: 'test', choices: [] };
  try {
    const r = await (o.fetchImpl ?? fetch)(`${checkoutBase(o.endpoint)}/options`, { signal: AbortSignal.timeout(o.timeoutMs ?? 8000) });
    if (!r.ok) return off;
    const j = (await r.json()) as Partial<OptionsResult>;
    return { enabled: !!j.enabled, mode: 'test', choices: Array.isArray(j.choices) ? j.choices : [] };
  } catch { return off; }
}

export async function startCheckout(leadId: string, choice: Pick<PayChoice, 'provider' | 'currency'>, o: Opts = {}): Promise<StartResult> {
  try {
    const r = await (o.fetchImpl ?? fetch)(checkoutBase(o.endpoint), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, provider: choice.provider, currency: choice.currency }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 15000),
    });
    const j = (await r.json().catch(() => ({}))) as { url?: string; code?: string; error?: string };
    if (r.ok && j.url && /^https?:\/\//.test(j.url)) return { ok: true, url: j.url };
    return { ok: false, code: j.code || `http_${r.status}`, message: j.error || 'We could not start the payment. Please try again, or wait for your invoice.' };
  } catch { return { ok: false, code: 'network', message: 'We could not reach the payment service. Please try again, or wait for your invoice.' }; }
}

export async function fetchPayStatus(leadId: string, o: Opts = {}): Promise<PayStatus> {
  try {
    const r = await (o.fetchImpl ?? fetch)(`${checkoutBase(o.endpoint)}/status?lead_id=${encodeURIComponent(leadId)}`, { signal: AbortSignal.timeout(o.timeoutMs ?? 8000) });
    if (!r.ok) return 'unknown';
    const j = (await r.json()) as { paymentStatus?: PayStatus };
    return j.paymentStatus || 'unknown';
  } catch { return 'unknown'; }
}

/** ?pay=success|cancel&lead=<uuid> as set by the server on the provider return URLs. */
export function parsePayReturn(search: string): { result: 'success' | 'cancel'; leadId: string } | null {
  const q = new URLSearchParams(search);
  const result = q.get('pay'); const leadId = q.get('lead') || '';
  if ((result !== 'success' && result !== 'cancel') || !/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  return { result, leadId };
}
