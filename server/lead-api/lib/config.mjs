// Lead API configuration. Everything comes from environment variables (names only are documented in .env.example); no secret has a default.
const int = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : d; };
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export function loadConfig(env = process.env) {
  return {
    port: env.LEAD_PORT === '0' ? 0 : int(env.LEAD_PORT, 8788),
    host: env.LEAD_HOST || '127.0.0.1',
    databaseUrl: env.DATABASE_URL || '', // PostgreSQL connection string; empty => JSON file store in dataDir
    databaseSsl: env.DATABASE_SSL === '1',
    dataDir: env.LEAD_DATA_DIR || new URL('../data', import.meta.url).pathname,
    // Origins that may call the API from a browser. Missing Origin (curl / server-to-server) is rejected unless LEAD_ALLOW_NO_ORIGIN=1.
    allowedOrigins: list(env.LEAD_ALLOWED_ORIGINS || 'https://fourcee.lutho.app'),
    allowNoOrigin: env.LEAD_ALLOW_NO_ORIGIN === '1',
    trustProxy: env.LEAD_TRUST_PROXY === '1', // use X-Real-IP set by nginx; only behind a trusted reverse proxy
    maxBodyBytes: 16 * 1024,
    rate: { perMin: int(env.LEAD_RATE_PER_MIN, 5), perHour: int(env.LEAD_RATE_PER_HOUR, 20), perDay: int(env.LEAD_MAX_PER_DAY_PER_IP, 40) },
    globalPerDay: int(env.LEAD_MAX_PER_DAY, 500), // hard cap on stored leads/notifications per UTC day (spam flood guard)
    smtp: {
      host: env.SMTP_HOST || '',
      port: int(env.SMTP_PORT, 587),
      secure: (env.SMTP_SECURE || 'starttls').toLowerCase(), // none | starttls | tls
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || '',
      rejectUnauthorized: env.SMTP_INSECURE_TLS !== '1',
      timeoutMs: int(env.SMTP_TIMEOUT_MS, 10000),
    },
    notifyTo: list(env.LEAD_NOTIFY_TO), // comma list of recipient addresses (the owner)
    sendConfirmation: env.LEAD_SEND_CONFIRMATION === '1', // optional receipt email to the prospect (off by default)
    webhookUrl: env.LEAD_WEBHOOK_URL || '', // Slack-compatible incoming webhook / n8n webhook / anything that accepts JSON
    webhookSecret: env.LEAD_WEBHOOK_SECRET || '', // optional: adds X-Fourcee-Signature: sha256=<hmac of body>
    webhookTimeoutMs: int(env.LEAD_WEBHOOK_TIMEOUT_MS, 8000),
    notifyMaxAttempts: int(env.LEAD_NOTIFY_MAX_ATTEMPTS, 6),
    notifySweepMs: int(env.LEAD_NOTIFY_SWEEP_MS, 60000),
    // Payments: TEST MODE ONLY in this build (live keys are refused at start-up, see lib/payments/common.mjs). Off unless PAYMENTS_ENABLED=1.
    pay: {
      enabled: env.PAYMENTS_ENABLED === '1',
      returnBase: env.PAY_RETURN_BASE_URL || '', // where the customer lands after paying, e.g. https://fourcee.lutho.app/ (default: first LEAD_ALLOWED_ORIGINS)
      zarPerUsd: Number(env.PAY_ZAR_PER_USD) > 0 ? Number(env.PAY_ZAR_PER_USD) : 0, // rand per dollar; 0 => ZAR checkout refused
      maxMinor: int(env.PAY_MAX_AMOUNT_MINOR, 100_000_000), // hard ceiling per charge, in cents (default 1,000,000.00)
      perIpPerHour: int(env.PAY_PER_IP_PER_HOUR, 10),
      maxAttemptsPerLead: int(env.PAY_MAX_ATTEMPTS_PER_LEAD, 10),
      stripe: { secretKey: env.STRIPE_SECRET_KEY || '', webhookSecret: env.STRIPE_WEBHOOK_SECRET || '', apiBase: (env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '') },
      paystack: { secretKey: env.PAYSTACK_SECRET_KEY || '', apiBase: (env.PAYSTACK_API_BASE || 'https://api.paystack.co').replace(/\/$/, '') },
    },
    demo: {
      enabled: env.DEMO_ENABLED !== '0', // kill switch: DEMO_ENABLED=0 -> every demo request answers 503 "paused", nothing is forwarded
      webhookUrl: env.N8N_DEMO_WEBHOOK_URL || '', // server-side only. The browser never sees or calls this URL.
      webhookSecret: env.N8N_DEMO_WEBHOOK_SECRET || '', // sent as X-Fourcee-Secret so n8n can reject anything not coming from this proxy
      webhookTimeoutMs: int(env.N8N_DEMO_TIMEOUT_MS, 10000),
      allowedCountries: list(env.DEMO_ALLOWED_COUNTRIES || '+1,+44,+27,+61,+91,+33,+49,+251,+971,+81'),
      defaultCountry: env.DEMO_DEFAULT_COUNTRY || '+27',
      perIpPerHour: int(env.DEMO_PER_IP_PER_HOUR, 3),
      perIpPerDay: int(env.DEMO_PER_IP_PER_DAY, 6),
      perNumberPerDay: int(env.DEMO_PER_NUMBER_PER_DAY, 2),
      perNumberCooldownSec: int(env.DEMO_NUMBER_COOLDOWN_SEC, 600), // minimum gap between two calls to the same number
      perDay: int(env.DEMO_MAX_PER_DAY, 40), // global daily cap = the spend cap (calls x your per-call cost)
      blocklist: list(env.DEMO_BLOCKLIST), // do-not-call: E.164 numbers, comma separated
      blocklistFile: env.DEMO_BLOCKLIST_FILE || '', // optional file, one E.164 per line, re-read on every request
      turnstileSecret: env.TURNSTILE_SECRET || '', // set => a valid Cloudflare Turnstile token is REQUIRED
      turnstileVerifyUrl: env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    },
  };
}
