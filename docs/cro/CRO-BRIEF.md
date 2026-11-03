# Fourcee per-prospect audit page: CRO brief

Status: 2026-10-03 (SAST). Scope: `apollo-xwb/fourcee-template`, the static SPA a cold-outreach prospect lands on.
Facts below are measured on the farm (Player3, headless Chromium, software GL). Anything labelled **HYPOTHESIS** is a guess to be tested, not a result and not a benchmark. No industry statistics are quoted anywhere in this document.
Evidence: `docs/cro/` (summary + screenshots); raw JSON of every run lives with the author on the box (`/workspace/fourcee-cro/evidence/`). Code: draft PR (see end).

## 1. The page today (measured, main @ aa2e0e8)

What a prospect actually walks through: email link, then `/`: a splash gate, then a 12-section marketing landing. Its hero button "Access my custom audit" opens `#/audit`: a second intro gate ("Proceed to report / Skip phone"), then a 14-section report.

| | phone 390x844 `/` | phone `#/audit` | desktop 1440x900 `/` | desktop `#/audit` |
|---|---|---|---|---|
| Document length | **13.5 screens** (11 409 px) | **15.7 screens** | 11.0 screens | 10.0 screens |
| Sections | 12 | 14 | 11 | 14 |
| CTAs in the page body | 12 buttons, 11 different labels | 8 | 13 | 8 |
| First conversion CTA ("Select a package" / "Go live in 2 hours") | 3.65 screens down (4 swipes) | 1.66 screens (after the intro-gate tap) | 1.91 screens | 1.48 screens |
| Before any content | splash 7.8 s | intro gate + ~4.7 s load | splash 5.2 s | ~4.9 s |
| Weight on first visit + full scroll | 12.7 MB | 20.1 MB | 12.6 MB | 20.1 MB |
| 3D / AR bytes | 1.3 MB | 2.3 MB + an 8.7 MB sphere `scene.bin` | 1.3 MB | same |

Other measured findings (`docs/cro/BEFORE-MEASUREMENTS.md`): a "Portal tip" popup covers the page ~2.8 s after load; the audit's own headline number ("R16 000-R26 000 a month") sits at ~2.5 screens on phone; render-blocking `cdn.tailwindcss.com` in `index.html`; demo-phone input is 12 px on phone (iOS zooms on focus); the old CTA copy says "Go live in 2 hours" which the onboarding audit found to be unverified.

## 2. Proposed structure (implemented in the draft PR)

Goal: one outcome, one number, one action, in the first screen; everything else on demand.

Phone, top to bottom (target <= 3 screens; built page = **1.9 screens**):

1. **Hero (screen 1).** Eyebrow: "Audit prepared for {name}". One-line outcome H1: **"Answer the calls {name} is missing."** 10-second proof card: **their own audit headline number** ("R16 000-R26 000 estimated revenue a month walking out unanswered", with the audit's own "estimate" disclaimer). **ONE primary CTA**, full width, 56 px, fully inside the first screen (top edge at 0.50 screens). Under it the truthful offer line: "Free audit · done-for-you setup · live within days".
2. **What happens next:** 3 one-line steps (walk through the audit / we set it up / live within days; "no caller hears it until you sign off").
3. **Social proof:** only what exists in the audit data: the prospect's own Google rating, review count and a quote ("Your customers already rate you 4.5 (100 reviews)"). Fourcee has no customer testimonials/logos in the repo, and none are invented. Slot for real ones later.
4. **Progressive disclosure:** 5 `<details>` accordions, closed: What the audit found (call volumes, per-call-type table), What the AI receptionist does, How setup works, two FAQs (reused from the existing site copy).
5. **Final CTA:** the same single action again, then footer (disclaimer, "See the full report", "Full overview", Terms).
6. **Sticky bottom CTA on phones:** the same button, shown only when neither the hero CTA nor the final CTA is on screen.

Also: no splash/intro gate; no 3D, charts, GIFs or video on this page (the 3D ring studio and long landing stay, unchanged, at `#/home`; the full report at `#/audit` still works and skips its intro gate when opened from here); separate JS entry chunk (React + 15 KB page) so the 3D bundle is only downloaded if the visitor leaves for the full app; 56 px tap targets; all inputs 16 px; tracking is self-hosted (section 4). Per-prospect content still comes from `/content.json` (same keys, no new required keys). If `content.json` fails to load, the page still renders with the CTA.

### The CTA, truthfully (flagged)

There is no "truthful-copy PR" in `apollo-xwb/fourcee-template` (open PRs at the time: #2, #8, #9, #10). Wording therefore follows `fourcee-outbound/03-offer-and-pricing.md` and the onboarding audit (`REPORT.md` P0.4): *free audit plus done-for-you setup, live within days* (the number of days is still [CONFIRM] with TK). It lives in one constant (`OFFER_LINE` in `lib/cro.ts`), so it can be switched when that PR lands.

| Flag (build-time env, `?cta=` can pick `hear` for tests) | CTA text | True today? |
|---|---|---|
| default / `VITE_CRO_CTA=book` | "Book my free audit walkthrough" (opens the Google Calendar appointment page in a new tab). An http(s) `VITE_CAL_BOOKING_URL` or `VITE_BOOKING_URL` overrides it. | Yes: founder-assisted walkthrough exists |
| `VITE_CRO_CTA=hear` | "Hear your AI receptionist in 60 seconds" (inline phone field, then one demo call through the guarded `/api/demo-call` (PR #12) - the browser never calls n8n) | Only after TK confirms the demo call works end to end, the guard from PR #12 is deployed with its secret and n8n Header Auth is on (leading-0 normalisation is done by the guard). I did not place a real call. |
| `VITE_CRO_CTA=golive` | "Go live in 5 minutes" | **No.** Cannot render unless `VITE_VOICE_ONBOARDING=1` **and** `VITE_ONBOARDING_URL` are set; otherwise falls back to `book`. Unit-tested. Flip only when the voice onboarding platform is live. |

Default is `book` because it is the only CTA that is true without any further verification. Switching to `hear` is one env change.

### Rollout flags

- `VITE_CRO_SHORT=0` at build time restores the legacy landing at `/`; `?v=full` / `?v=short` on the URL choose per visitor, so the outreach tool can send half the list each link (A/B) without a rebuild.
- Not deployed. Merging and deploying are TK's call.

## 3. Result of the build (measured, same method and fixture as section 1)

| | phone `/` before | phone `/` after | desktop `/` before | desktop `/` after |
|---|---|---|---|---|
| Document length | 13.5 screens | **1.9 screens** | 11.0 | **1.7** |
| Sections | 12 | 5 | 11 | 5 |
| CTA buttons in body | 12 (11 labels) | 2 (same label) + sticky copy on phone | 13 | 2 |
| Primary CTA position | 3.65 screens (first purchase CTA); hero has 3 non-converting buttons | **0.50 screens**, inside the first screen | 1.91 | **0.54** |
| Swipes to reach it | 4 | **0** | 2 | **0** |
| Splash / gate | 7.8 s | none | 5.2 s | none |
| Requests / weight | 29 / 12.7 MB | **12 / 0.45 MB** | 28 / 12.6 MB | 12 / 0.45 MB |
| 3D bytes | 1.3 MB | 0 | 1.3 MB | 0 |
| First contentful paint | 3.8 s (this is the splash) | 1.0 s | 1.1 s (splash) | 1.0 s |
| CLS | 0.001 | 0.001 | 0 | 0.001 |
| Words visible in the first screen | 93 | 101 (hero block alone: 46) | 132 | 131 (hero block: 59) |

Honest notes: raw "words in the first screen" did not drop, because a shorter page lets the next section peek into the first screen; the competing-choices count did (1 CTA vs 5-8 buttons and fields). Remaining first-paint blockers are outside this PR: `cdn.tailwindcss.com` and Google Fonts in `index.html` (the `load` event waits ~3.7 s on them on the farm; FCP is ~1.0 s). Removing the Tailwind CDN script needs a styling regression pass on the legacy pages, so it is a follow-up, not smuggled into this PR.

## 4. Measurement: events and metrics (self-hosted, no paid analytics)

Tracker: `lib/track.ts`, ~100 lines, no cookies, no third-party script, `sessionStorage` session id, honours Do-Not-Track / Global Privacy Control, no phone numbers or other PII in events, batches via `sendBeacon` (`text/plain`, so no CORS preflight) to `VITE_TRACK_URL`. With no URL set nothing leaves the browser.

**Proposed contract for the Fourcee platform API** (`POST /v1/public/events`; not built yet: `fourcee-platform/repo/api` has no routes at the time of writing). Body: `{v:1, sid, lead_id, variant, page, vw, vh, mobile, ref, utm:{source,medium,campaign,content}, events:[{n, t, p}]}`. Server must: cap body size, allow-list origins and event names, rate-limit per IP, store raw rows in a `page_events` table, and never join to anything but `lead_id`.

| Event | When | Props |
|---|---|---|
| `page_view` | content loaded | `content` true/false |
| `cta_view` | primary CTA first >=60% visible | `time_to_cta_ms` |
| `engaged` | first tap, or scroll >= 10% | `why` |
| `scroll_depth` | 25 / 50 / 75 / 100 % of the page, once each | `pct` |
| `cta_click` | any CTA | `pos` hero/sticky/final, `variant`, `time_to_click_ms` |
| `accordion` | a detail section toggled | `id`, `open` |
| `form_start / form_submit / form_error / form_success` | demo-call form (`hear` variant) | `form`, `reason` |
| `nav` | footer links | `to` |
| `dwell_15s`, `page_hide` | timer, tab hidden/closed | `dwell_ms`, `max_scroll_pct`, `engaged` |

Metric definitions (all computed in SQL on `page_events`):

- **CTR from email** = unique human sessions with `utm_source` = the outreach tool / emails delivered (denominator from the sending tool). A "human session" is `page_view` followed by `engaged`, which excludes link scanners that fetch the page without scrolling or tapping.
- **Scroll depth** = share of human sessions reaching 25/50/75/100.
- **CTA click rate** = sessions with `cta_click` / human sessions; split by `pos` and `variant`.
- **Time to CTA** = median `time_to_cta_ms` (`cta_view`) and `time_to_click_ms`.
- **Bounce** = `page_view` sessions with no `engaged`, no `cta_click`, no `accordion` and no `nav` event.
- **Form completion** (only if the `hear` variant is on) = `form_success` / `form_start`.
- Compare variants with `?v=short` vs `?v=full` (and `?cta=`); the `variant` field carries the CTA variant, `page` the page.

## 5. Targets (HYPOTHESES, not facts)

These are decision thresholds we set ourselves; none is a forecast or a published benchmark.

- H1: the short page's CTA click rate is higher than the legacy page's when sent to comparable prospects. Decision rule proposed: keep the short page if its click rate is not lower, on a sample of at least 100 human sessions per arm.
- H2: bounce is lower on the short page than on the legacy page (same sample rule).
- H3: median time to CTA < 1 s from first paint (by construction on the short page: measured CTA in the first screen; the metric confirms it on real devices).
- H4: >= 50% of human sessions reach 50% scroll depth (a design guess; adjust after the first real data).
- H5: switching the CTA to `hear` raises click-to-demo conversion versus `book`. Untested; requires the demo flow to be verified first.
- Caveat on power: outreach volume is limited by TK's audit/setup capacity, so samples will be small. Expect directional evidence plus session replays/qualitative review, not significance claims. No numbers are promised.

## 6. Not covered / follow-ups

- Real iPhone/Android devices (only Chromium emulation on the farm; Safari's zoom-on-focus is not reproduced by emulation, so the check is "all inputs >= 16 px and `visualViewport.scale` stays 1").
- The event endpoint does not exist yet; events are verified only up to the beacon request.
- The booking page is the founder's Google Calendar appointment link. The 30-minute length on older copy still needs TK's confirmation (the old page said "15-minute strategy call").
- Real Fourcee testimonials/logos for the social-proof slot.
- Removing `cdn.tailwindcss.com`; compressing/removing the 5 MB `nivoda.gif` and 3.7 MB `placeholder.gif` from the legacy landing; the 8.7 MB sphere in the audit intro (legacy pages remain heavy).
- Currency/locale: the legacy ROI calculator shows `$` for a ZAR audit. Out of scope here.
