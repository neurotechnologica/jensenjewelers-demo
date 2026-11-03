# P0.3 demo webhook lockdown: evidence

Tested locally on the farm (no GitHub CI): Player3 (Windows, Node 24, Playwright 1.63), fake store **Test & Co Jewellers**. n8n and Cloudflare Turnstile are **mocked locally**; the real `app.fourcee.online` webhook was never contacted, no real call was placed.

| Check | Result |
|---|---|
| Unit (vitest) on Player3 | 230 passed, 1 skipped (Postgres half of the store suite) |
| Guard unit/integration (`tests/demo-guard.test.ts`, 25 cases): SA normalisation, forwarding payload + `X-Fourcee-Secret`, origin allow-list, honeypot, kill switch, do-not-call, per-IP hour/day, per-number cooldown/day, global daily cap + UTC rollover, n8n failure refunds budget, masked logs, Turnstile (missing / bad / good / verifier down = fail closed) | all pass |
| Phone vectors (`tests/phone.test.ts`, 79 cases) browser `lib/phone.ts` and server `phone.mjs` give identical results, incl. 3000 fuzz inputs | pass |
| Playwright E2E on Player3 (demo-call + lead-capture specs), `iphone14` 390x844 and `desktop-1366x768` | 22 passed |
| Built bundle contains no `voice-demo-request` / `app.fourcee.online` | pass (asserted in E2E) |

E2E cases: SA number typed `082 123 4567` becomes `+27821234567` at the fake n8n (never `+270...`) with the shared-secret header, and the browser's only POST is to our guard; invalid / premium numbers (`0861234567`, `12345`) show an inline message with zero requests; kill switch shows "paused" with no `alert()` and nothing forwarded; Turnstile token from the (stubbed) widget is sent and verified server-side.

Screenshots: `d1` before call, `d2` call initiated, `d3` invalid number, `d4` paused, desktop and iphone14.
Timing: click Call to "Call initiated" about 4.2 s in both profiles. That figure includes Playwright actionability waits on a software-GL page; the guard round trip itself is milliseconds on localhost. Real call latency is the voice stack's, not measured.

Not tested: the real n8n workflow (header-auth step is documented, not applied), the real Cloudflare widget/siteverify, nginx `limit_req`, real iOS Safari, abuse from many IPs (counters are per process and reset on restart).

Raw evidence: `/workspace/fourcee-p0/evidence/p0-2-demo-webhook-guard/` on the box.
