// Cloudflare Turnstile server-side verification (optional captcha hook). Enabled when TURNSTILE_SECRET is set.
// The verify URL is configurable so tests point it at a local mock; nothing here calls Cloudflare unless you configure a real secret.
export async function verifyTurnstile(cfg, token, ip, fetchImpl = fetch) {
  if (!cfg.turnstileSecret) return { ok: true, skipped: true };
  if (typeof token !== 'string' || token.length < 10 || token.length > 2100) return { ok: false, reason: 'captcha_missing' };
  try {
    const body = new URLSearchParams({ secret: cfg.turnstileSecret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(cfg.turnstileVerifyUrl, { method: 'POST', body, signal: AbortSignal.timeout(6000) });
    const j = await res.json().catch(() => ({}));
    return j.success === true ? { ok: true } : { ok: false, reason: 'captcha_failed' };
  } catch {
    return { ok: false, reason: 'captcha_unavailable' }; // fail closed: if we cannot verify, we do not place a call
  }
}
