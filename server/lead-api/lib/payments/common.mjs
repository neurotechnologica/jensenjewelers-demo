// Shared by the payment providers: test-key guard, signature helpers, constant-time compare.
import crypto from 'node:crypto';

/** Hard guard: this build is TEST MODE ONLY. A live key is refused at start-up and again before every provider call. */
export function assertTestKey(name, key) {
  if (!key) return;
  if (/live/i.test(key) || !/^(sk|rk)_test_/.test(key)) throw new Error(`${name} must be a TEST key (sk_test_...). Live keys are refused by this build.`);
}
export const tsEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
export const hmac = (algo, secret, data) => crypto.createHmac(algo, secret).update(data).digest('hex');
export const form = (obj) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null) p.append(k, String(v)); return p.toString(); };
export class ProviderError extends Error { constructor(msg, status = 502) { super(msg); this.status = status; } }
export class SignatureError extends Error { constructor(msg) { super(msg); this.status = 400; } }

export async function fetchJson(fetchImpl, url, init, timeoutMs = 10000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(url, { ...init, signal: ctl.signal });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    if (!r.ok) throw new ProviderError(`provider HTTP ${r.status}${json?.error?.message ? `: ${json.error.message}` : json?.message ? `: ${json.message}` : ''}`);
    return json;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(`provider unreachable: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
  } finally { clearTimeout(t); }
}
