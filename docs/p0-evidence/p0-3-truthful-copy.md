# P0.3 truthful copy: evidence

Run on the test farm (Player3, Windows, Node 24, Playwright 1.63, Chromium emulation), fake store "Test & Co Jewellers". No real emails, SMS, calls or payments.

| Check | Result |
|---|---|
| `vitest run` (7 files, includes `tests/copy-claims.test.ts`, 13 claim lint tests) | 74 passed |
| `copy-claims` lint run against `main` | fails (it finds the old claims), so the lint really guards |
| `tsc --noEmit` | 3 errors, same 3 as `main` (Pendant3D, PendantFBX, framer Transition) |
| Playwright `e2e/copy-truthful.spec.ts`, iphone14 390x844 + desktop-1366x768 | 10 passed |
| Playwright on `main` + same spec (`E2E_BEFORE=1`) | screenshots only; assertion tests skipped by design |

What the e2e asserts on the rendered page: no "2 hours", "hands-off", "fully automatic" or "never lose another"; checkout headline "Free audit, then done-for-you setup"; "live within days"; a ZAR store shows "Quote in ZAR" notes and a USD store does not; the "What is live today, and what is not" list opens and contains both groups; the invoice step and confirmation say nothing is live and no payment was taken; audit CTAs say "Get live within days"; home page visible text has none of the banned claims.

Screenshots (before/after, both profiles): `/workspace/fourcee-p0/evidence/p0-3-truthful-copy/player3/{before,after}-{iphone14,desktop-1366x768}-*.png`; logs in `.../player3/logs/`.

## Not verified or left for the owner
- Every line of `lib/capabilities.ts` (live / setup / soon) is the author's reading of the code and the audit. The owner must confirm each line is true before this ships.
- Claims outside the files this PR touches were not changed: voice-cloning "100 simultaneous calls", "Live Estimates", the chat knowledge base ("ROI within 90 days", 24/7; that area is in PR #10), the testimonial "Our ROI was instant", and generated `content.json` text such as "answer every call 24/7".
- ZAR: without `VITE_ZAR_PER_USD` the page says "Quote in ZAR" and shows no converted price. Setting it shows "about R…" as an indication only.
- Real iOS Safari and real devices were not used.
