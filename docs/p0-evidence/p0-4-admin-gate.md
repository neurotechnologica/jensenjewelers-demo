# P0.4 admin gate + sample-data labelling: evidence

Run on the test farm (Player3, Windows, Node 24, Playwright 1.63, Chromium emulation). No real services involved.

| Check | Result |
|---|---|
| `vitest run` (7 files, includes `tests/admin-gate.test.ts`) | 65 passed |
| `tsc --noEmit` | 3 errors, same 3 as `main` |
| Playwright `e2e/admin-gate.spec.ts` on this branch, iphone14 390x844 + desktop-1366x768 | 8 passed |
| Same spec on `main` (`E2E_BEFORE=1`) | screenshots only; logs `BEFORE (main build) shows admin screen: true` |

What the e2e proves (default build, no env flag):
- `#/admin`, typed as a deep link and also switched to after the page has loaded, shows the landing page; no "Admin - Voice AI SaaS" text; no hidden admin button.
- The served JS bundles contain no admin screen, no "Hidden admin access", no PhoneTester. The build emits no `AdminDashboard` chunk. The spec first checks that the files the server serves exist in this checkout's `dist-e2e`, so a stray dev server on the same port cannot give a false pass.
- With `VITE_ENABLE_ADMIN=1` (second build on its own port) the admin opens and carries the "Internal preview · sample data only" banner.
- `#/ops` (the demo portal): KPIs, call log, transcript and actions are labelled "sample", the banner says nothing is real, and 12 seconds later the page text is identical (the old random lead, revenue, booking and channel timers are gone).

Screenshots: `/workspace/fourcee-p0/evidence/p0-4-admin-gate/player3/{before,after}-{iphone14,desktop-1366x768}-*.png` (before = `main`). Logs in `.../player3/logs/`.

## Not verified or left for the owner
- `VITE_ENABLE_ADMIN=1` has no login. It is for a private local or staging build only; the production build should leave it empty.
- The `#/ops` portal remains a walkthrough with placeholder data ("PLACEHOLDER Business"). Whether it should stay reachable by customers is the owner's decision; it is clearly labelled sample in this PR.
- Real iOS Safari not used.
