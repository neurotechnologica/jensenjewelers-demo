# Payments (test mode only)

Status: draft. **Test keys only.** The server refuses to start if `STRIPE_SECRET_KEY` or `PAYSTACK_SECRET_KEY` is anything other than an `sk_test_...` / `rk_test_...` key (live keys, `pk_` keys and anything containing "live" are rejected, even when `PAYMENTS_ENABLED` is off). Going live is a separate, deliberate change that is not part of this PR.

## Flow

1. The customer submits the "Request invoice" form. The lead is stored (see `README.md`) with `paymentStatus: "unpaid"` and its add-ons.
2. If payments are on, the confirmation step shows "Test mode: no real money moves" and one button per method.
3. `POST /api/checkout { lead_id, provider, currency }` creates a hosted Checkout Session **on the server** and returns `{ url }`. **The browser never sends an amount.** The server prices the lead from its plan, billing cycle and add-ons (`lib/pricing.mjs`, kept equal to `constants.tsx` by a unit test). The lead becomes `paymentStatus: "pending"` with `payment: { provider, ref, amountMinor, currency, sessions, ... }`.
4. The customer pays on the provider's page and is redirected back to `PAY_RETURN_BASE_URL?pay=success&lead=<id>#/checkout`.
5. The provider calls our webhook. The webhook, not the redirect, decides: the signature is verified over the raw body, the session is matched to the lead, amount and currency must equal what we asked for, then the lead becomes `paid` and the owner gets a "payment received (test)" email/webhook. The page polls `GET /api/checkout/status` and shows the result.

States on `lead.paymentStatus`: `unpaid` (default, expired or cancelled), `pending` (session created), `paid`, `failed`, `review` (amount or currency mismatch, needs a human). Full detail is in `lead.payment` (a `jsonb` `extra` field in PostgreSQL, so no schema change).

## Endpoints

| Method and path | Who calls it | Notes |
|---|---|---|
| `GET /api/checkout/options` | browser | enabled methods and currencies; no secrets |
| `POST /api/checkout` | browser (Origin allow-list) | per-IP hourly cap, per-lead attempt cap, 409 if already paid |
| `GET /api/checkout/status?lead_id=` | browser | returns `paymentStatus` only |
| `POST /api/pay/webhook/stripe` | Stripe | `Stripe-Signature`, HMAC-SHA256 of `t.rawBody`, 5 minute tolerance |
| `POST /api/pay/webhook/paystack` | Paystack | `x-paystack-signature`, HMAC-SHA512 of the raw body |

Webhooks have no browser `Origin`; the signature is the authentication (constant-time compare). Bad signature, stale timestamp or tampered body: 400 and nothing changes. Redelivered events are no-ops (event ids are kept on the lead). Unknown leads or sessions and event types we do not use get a 200 so the provider stops retrying. A second session that also pays is recorded under `payment.duplicatePaid` and the first payment is kept (refund decision is manual). Expiry or failure never undoes a paid lead.

## Currencies

USD amounts follow the site price list. **ZAR:** the owner sets `PAY_ZAR_PER_USD` (rand per dollar). The amount is rounded to whole rand. Without it, ZAR checkout answers 503 "Rand pricing is not available yet" and no rand price is shown. Paystack here is ZAR only; Stripe can take USD and ZAR. PayFast is not included; it would be a third provider file behind the same interface (`createCheckout`, `verifyWebhook`, `parseEvent`).

## Owner configuration

| Variable | Meaning |
|---|---|
| `PAYMENTS_ENABLED=1` | master switch (default off) |
| `PAY_RETURN_BASE_URL` | where the customer returns, e.g. `https://fourcee.lutho.app/` (default: first `LEAD_ALLOWED_ORIGINS`) |
| `PAY_ZAR_PER_USD` | rand per dollar; empty disables ZAR |
| `STRIPE_SECRET_KEY` | `sk_test_...` from the Stripe dashboard (test mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` of a test-mode webhook endpoint pointing at `https://<host>/api/pay/webhook/stripe`, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` from Paystack (test mode); set the webhook URL in the dashboard to `https://<host>/api/pay/webhook/paystack` |
| `PAY_PER_IP_PER_HOUR`, `PAY_MAX_ATTEMPTS_PER_LEAD`, `PAY_MAX_AMOUNT_MINOR` | abuse and sanity limits (defaults 10, 10, 1,000,000.00) |
| `STRIPE_API_BASE`, `PAYSTACK_API_BASE` | only for tests: point at `dev/mock-providers.mjs` |
| `VITE_PAYMENTS_ENABLED=1`, `VITE_CHECKOUT_ENDPOINT` | build-time flag for the browser button |

nginx: the payment locations are in `deploy/nginx-lead-api.conf.example`. Do not cache it and do not add basic auth in front of the webhook paths (the providers cannot answer it).

## Trying it locally with no provider and no money

`server/lead-api/dev/mock-providers.mjs` is a module used by the tests (`startMockProviders`): a fake Stripe and Paystack that serve a "Complete test payment" page and send correctly signed webhooks. Use it with `STRIPE_API_BASE` / `PAYSTACK_API_BASE`. To use the real providers' sandboxes instead, use your test keys and the provider's CLI or dashboard to forward webhooks (for Stripe: `stripe listen --forward-to localhost:8788/api/pay/webhook/stripe`).

## Before any live use (not done here)

Decide the business entity and tax/VAT treatment, whether card payment is offered at all given the manual-setup offer, refunds and chargebacks process, receipts/invoices, and a security review of the webhook endpoint behind the real reverse proxy. Add live keys only after that, in a separate change.
