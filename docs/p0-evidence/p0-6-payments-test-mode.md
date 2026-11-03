# P0.6 payments, test mode only: evidence

Run on the test farm (Player3, Windows, Node 24, Playwright 1.63, Chromium emulation) on unusual ports (47xxx). Stripe and Paystack are replaced by a local mock (`server/lead-api/dev/mock-providers.mjs`) that sends correctly signed webhooks. No provider was contacted, no key other than a fake `sk_test_...` string was used, no money moved.

| Check | Result |
|---|---|
| Player3 `vitest run` (14 files; includes `tests/payments.test.ts`, `tests/checkout-client.test.ts`) | 269 passed, 2 skipped (PostgreSQL suites, no database on that PC) |
| Box `vitest run` with a real PostgreSQL 17 (`TEST_DATABASE_URL`) | 277 passed, including create session -> signed webhook -> paid read back from the database |
| `tsc --noEmit` | 3 errors, same 3 as `main` |
| Playwright iphone14 390x844 + desktop-1366x768: `payments`, `lead-capture`, `demo-call` specs | 32 passed, 2 skipped (by design) |

Server tests cover: the charged amount is computed on the server and a browser-supplied amount is ignored; prices equal `constants.tsx`; ZAR needs `PAY_ZAR_PER_USD` (else 503) and is whole rand; **live keys refuse start-up** (`sk_live_`, `rk_live_`, `pk_`, anything containing "live"); Stripe signature wrong secret / stale / future timestamp / missing / malformed / tampered body all give 400 and leave the lead unpaid; Paystack bad or missing HMAC gives 400; redelivered events are no-ops and do not notify twice; amount or currency mismatch is flagged `review`, never `paid`; unknown lead, unknown session and unrelated event types get 200 and change nothing; expiry or failure never undoes a paid lead; a second paying session is recorded as `duplicatePaid`; per-lead attempt cap, per-IP cap, disallowed Origin refused, payments off by default.

E2E (real browser -> real lead API -> mock provider): pay with card (USD 5,997.00 shown on the provider page, lead `paid`, banner "Test payment received", owner notice sent), pay in rand (R110 945.00 from the test rate 18.5), cancel at the provider (not paid), server down (calm message, lead untouched), bundle contains no key or provider host. Pay buttons are at least 44px high. Click to paid banner: 4.2 s (iphone14), 4.6 s (desktop) including the mock redirects and software GL.

Screenshots and timings: `/workspace/fourcee-p0/evidence/p0-6-payments-test-mode/player3/` (files `*-01-request-sent-pay-options`, `*-02-mock-stripe-hosted-page`, `*-03-paid-banner`, `*-04-mock-paystack-hosted-page`, `*-05-cancelled-banner`, `*-payments-timings.json`; the lead-capture and demo-call shots from the regression run are in the same folder).

## Not tested
- The real Stripe and Paystack APIs and their test sandboxes (request shapes follow their public docs; verify once with real test keys and `stripe listen`).
- Real webhook delivery through nginx, TLS and the public hostname.
- Real iOS Safari, real cards, 3-D Secure, async payment methods, refunds, chargebacks.
- PayFast is not implemented.
