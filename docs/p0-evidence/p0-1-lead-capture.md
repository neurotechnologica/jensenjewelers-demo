# P0.1 lead capture: evidence

Tested locally on the farm (no GitHub CI): Player3 (Windows, Node 24, Playwright 1.63 Chromium) with the fake store **Test & Co Jewellers**.
Mail = local SMTP mail catcher, webhook = local receiver, database = local only. No real email, SMS, call or payment.

| Check | Result |
|---|---|
| Unit (vitest) on Player3 | 120 passed, 1 skipped (the Postgres half needs a database) |
| Unit on the box with a throwaway PostgreSQL 17 (`TEST_DATABASE_URL`) | 127 passed (JSON-file store and Postgres store pass the same contract suite; API run end to end on Postgres incl. restart) |
| Playwright E2E on Player3, `iphone14` (390x844 touch) + `desktop-1366x768` | 12 passed |
| `tsc --noEmit` | same 3 pre-existing errors as main, none new |

E2E cases: blank/invalid details blocked with inline errors and zero network requests; happy path (POST carries name, email, phone, store, plan, notes, CRM, billing, idempotency key; lead stored; owner email + signed webhook received; reference shown); server down shows the error, keeps the lead in `localStorage`, Retry delivers it exactly once; queued lead is re-sent on the next visit without duplicating; honeypot bot is dropped; pinch-zoom not disabled.

Timings (Player3, software GL): click "Request invoice" to success shown 417 ms (iphone14) / 235 ms (desktop); Retry after outage 2389 ms / 192 ms.

Mobile input rule (390x844): 10 visible controls across `#/checkout` details, `#/audit`, `#/`, `#/ops` (Onboard textarea) and `#/admin` search all compute to **16 px**, and `visualViewport.scale` stays **1** after tapping each.

Not tested: real iOS Safari (Chromium emulation does not reproduce the iOS focus-zoom itself; the 16 px computed size is the controlling check), real SMTP provider, real Slack/n8n webhook, nginx/systemd deployment, load.

Raw evidence (screenshots, JSON, logs): `/workspace/fourcee-p0/evidence/p0-1-lead-capture/` on the box.
