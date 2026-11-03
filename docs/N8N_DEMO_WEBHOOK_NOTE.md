# n8n side of the demo-call lockdown (note for Software Engineer)

**Nothing in n8n was touched by this PR.** The site no longer calls `https://app.fourcee.online/webhook/voice-demo-request` from the browser: it calls our guard (`POST /api/demo-call` in `server/lead-api`), which validates, normalises, rate-limits and only then POSTs the same payload to n8n from the server.

## What n8n receives now
`POST <N8N_DEMO_WEBHOOK_URL>` with `Content-Type: application/json`

```json
{ "phone_number": "+27821234567", "lead_id": "e75f4a82-..." }
```
`phone_number` is always strict E.164 (the leading-0 bug that produced `+270821234567` is fixed at the source), only for allowed countries, never a premium/freephone range. Header `X-Fourcee-Secret: <N8N_DEMO_WEBHOOK_SECRET>` is added by the guard.

## Changes to make in n8n (when you are ready; none are required for the site to keep working)
1. **Require the secret.** Webhook node -> Authentication -> *Header Auth*, name `X-Fourcee-Secret`, value = the same string you put in `N8N_DEMO_WEBHOOK_SECRET` on the guard. Anything calling the webhook directly without it is then rejected by n8n itself, which closes the "anyone can curl it" hole. Do this AFTER the guard is live with the secret set, otherwise the current site (browser direct) would break.
2. **Stop reflecting CORS.** Webhook node -> Options -> *Allowed Origins (CORS)*: remove `*`. The browser no longer calls n8n, so no origin needs to be allowed.
3. **Defence in depth (optional, cheap).** First node after the webhook: IF `phone_number` matches `^\+[1-9]\d{7,14}$`, else stop. Add a spend counter or an alert on > N executions/hour of this workflow.
4. **Per-prospect `lead_id`.** The template ships a shared default UUID; the workflow should treat an unknown `lead_id` as "generic demo".
5. Exposure of the n8n editor itself is a separate item (see `N8N_EXPOSURE_NOTE.md` if present).

## Verify (public HTTP only, no production writes beyond a harmless rejected request)
```bash
# before step 1: expect the current behaviour (note it); after step 1: no secret -> 403/401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://app.fourcee.online/webhook/voice-demo-request -H 'content-type: application/json' -d '{}'
# CORS after step 2: no Access-Control-Allow-Origin for a foreign origin
curl -s -i -X OPTIONS https://app.fourcee.online/webhook/voice-demo-request -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST' | grep -i access-control
```
Do not run a real call test with a real number from CI or scripts; use a single manual test with an owner-held number.

## Rollback
Remove the Header Auth on the webhook node and (if needed) re-add the allowed origin; set `DEMO_ENABLED=0` on the guard to pause demo calls instantly without touching n8n.
