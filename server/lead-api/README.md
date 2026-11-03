# Fourcee lead API

Receives the "Request invoice" lead from the site, stores it, and tells the owner. Zero runtime dependencies on the default JSON-file store;
PostgreSQL when `DATABASE_URL` is set. This directory is a self-contained Node (>= 18) service. **Nothing here is deployed by the repo.**

```
browser (mobile first)  --POST /api/lead-->  nginx  -->  lead-api (127.0.0.1:8788)  -->  store (Postgres | JSON file)
                                                                                    -->  owner: SMTP email and/or webhook (Slack, n8n, ...)
```

## What it does
* `POST /api/lead` JSON: `name, email, store, plan` (required), `phone, notes, crm, billing_cycle, total, currency, page_url` (optional), `idempotency_key` (the site sends one per form so retries never duplicate), `website` (honeypot, must be empty).
* Validates on the server (the browser validation is only for UX), strips CR/LF from single-line fields (no mail header injection), caps body at 16 KB.
* **Stored before it answers.** `201` means the lead is in the store; notification then runs in the background and is retried by a sweep (every 60 s, up to `LEAD_NOTIFY_MAX_ATTEMPTS`) so an SMTP or webhook outage never loses a lead.
* Abuse controls: exact **origin allow-list** (`LEAD_ALLOWED_ORIGINS`, requests with no Origin are refused unless `LEAD_ALLOW_NO_ORIGIN=1`), per-IP limits (minute / hour / day), a global daily cap, a **honeypot** field (bots get a fake success and nothing is stored or sent).
* `GET /api/health` -> `{ok, notify, leads}`.

## Demo-call guard (`POST /api/demo-call`)
The browser never calls the n8n webhook. It posts `{phone, country, lead_id, website, turnstile_token}` here; the guard then POSTs `{phone_number: "+27821234567", lead_id}` to `N8N_DEMO_WEBHOOK_URL` with `X-Fourcee-Secret`.
Checks, in order: kill switch (`DEMO_ENABLED=0`) -> origin allow-list -> burst shield -> body + honeypot -> **SA/E.164 normalisation** (`0821234567` -> `+27821234567`, premium/freephone ranges and unlisted countries rejected) -> do-not-call list -> optional **Turnstile** (`TURNSTILE_SECRET`, fails closed) -> per-IP hour/day -> per-number cooldown + day -> global daily cap -> forward. Only a request that passes everything spends budget; a failed forward gives the daily budget back. Logs carry masked numbers only. Counters are in memory (reset on restart); the daily cap is per UTC day.
n8n-side changes: see `docs/N8N_DEMO_WEBHOOK_NOTE.md`.

## Payments (test mode only)
Hosted Checkout (Stripe, Paystack/ZAR) created server-side, signed webhooks mark the lead paid. Off by default; live keys are refused. See [PAYMENTS.md](PAYMENTS.md).

## Store (repository interface)
`lib/store.mjs` documents the interface (`add, get, findByIdempotencyKey, update, countSince, count, pendingNotifications, close`).
* `DATABASE_URL` empty -> `JsonFileStore` (atomic file rewrite, fine for development and a small single-box install).
* `DATABASE_URL=postgres://user:pass@host:5432/db` -> `PostgresStore` (`lib/store-pg.mjs`). Install the driver once: `npm install pg` (it is an `optionalDependency`). The table is created by `sql/001_leads.sql`, applied idempotently at start-up. Fields owned by later modules (payment provider ids, ...) go to the `extra jsonb` column, so the table needs no migration per feature.
* Another database = another class with the same methods; nothing else changes. `tests/lead-store.test.ts` is the contract suite both stores pass (set `TEST_DATABASE_URL` to run the Postgres half against a throwaway database).

## Configuration
All via environment variables, see `.env.example` (names only; real values live in `/etc/fourcee/lead-api.env`, mode 600, never in git).
Owner notification: set `SMTP_HOST, SMTP_PORT, SMTP_SECURE (starttls|tls|none), SMTP_USER, SMTP_PASS, SMTP_FROM, LEAD_NOTIFY_TO` and/or `LEAD_WEBHOOK_URL` (+ optional `LEAD_WEBHOOK_SECRET`, which adds `X-Fourcee-Signature: sha256=<hmac of body>`). `LEAD_SEND_CONFIRMATION=1` also emails the prospect a receipt. With neither channel configured the service starts, stores leads, and logs a warning.

## Run
```bash
cp server/lead-api/.env.example /etc/fourcee/lead-api.env   # fill in, chmod 600
set -a; . /etc/fourcee/lead-api.env; set +a
node server/lead-api/index.mjs
```
Local dev without real mail: `node server/lead-api/dev/mail-catcher.mjs` (SMTP on 2525, messages on http://127.0.0.1:2580/messages), then `SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_SECURE=none`.

## Site build
`VITE_LEAD_ENDPOINT` (build time) is the URL the form posts to; default `/api/lead` (same origin, via nginx). Behind nginx on the same host no CORS is needed; if the API is on another origin list the site origin in `LEAD_ALLOWED_ORIGINS`.
If the request fails the form shows an error with **Retry**, and the lead is kept in `localStorage` (`fourcee.leadQueue.v1`) and re-sent on the next visit or when the browser goes online.

## Deploy behind nginx (reference, not applied)
`deploy/nginx-lead-api.conf.example` and `deploy/fourcee-lead-api.service.example` in this folder. Key points: the app listens on 127.0.0.1 only, nginx sets `X-Real-IP` (so set `LEAD_TRUST_PROXY=1`), TLS terminates at nginx, and nginx adds its own coarse `limit_req` in front of the app limits.
