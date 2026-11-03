# BEFORE: current page (main @ aa2e0e8), measured on Player3 (farm), 2026-10-03 21:27 SAST

Setup: `vite build` + `vite preview` (127.0.0.1:4173, uncompressed, no CDN), headless Chromium via Playwright, software GL (swiftshader), fake prospect "Test & Co Jewellers (TEST)" content.json. Phone = 390x844 @2x touch UA; desktop = 1440x900. Script: `scripts/cro-measure.mjs`; raw JSON + every screenshot: `evidence/before/`.
What a prospect lands on: the SPA root (`/`) = global splash gate -> long marketing landing (12 sections). Its hero button "Access my custom audit" goes to `#/audit` = a second intro gate ("Proceed to report / Skip phone") -> the long audit report (14 sections). Both routes are measured.

| view | route | doc height (px) | screens (docH/vh) | sections | words in first view | CTAs (non-dock) | first conversion CTA (screen #) | swipes to bring it fully into view | splash/gate until content (s) | FCP / LCP (ms) | requests | transfer MB (as served) | 3D MB | long-task sum >50ms (s)* | CLS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| phone 390x844 | (root) | 11409 | 13.52 | 12 | 93 | 12 (+5 fixed) | Select A Package @ 3.65 | 4 | 7.8 (h1 visible 8.0) | 3792 / 3792 | 29 | 12.7 | 1.3 | 12.2 | 0.001 |
| phone 390x844 | #/audit | 13233 | 15.68 | 14 | 101 | 8 (+4 fixed) | Go Live In 2 Hours @ 1.66 | 1 | 4.7 (h1 visible 4.8) | 1112 / 4696 | 27 | 20.1 | 2.3 | 101.3 | 0.094 |
| desktop 1440x900 | (root) | 9937 | 11.04 | 11 | 132 | 13 (+3 fixed) | Select A Package @ 1.91 | 2 | 5.2 (h1 visible 5.4) | 1124 / 1124 | 28 | 12.6 | 1.3 | 9.3 | 0 |
| desktop 1440x900 | #/audit | 9007 | 10.01 | 14 | 95 | 8 (+4 fixed) | Go Live In 2 Hours @ 1.48 | 1 | 4.9 (h1 visible 5.3) | 1100 / 4752 | 27 | 20.1 | 2.3 | 48.5 | 0.06 |

\* Long-task sums are inflated by software-rendered WebGL/Canvas on a headless farm PC; treat as "main thread is busy a lot", not as a real-device number. Screens = scrollable container height / viewport height (the app scrolls an inner `h-screen overflow-y-auto` div, not the window). "Swipes" = 0.85-viewport scroll steps needed to bring the first conversion CTA fully into view. Transfer = bytes as served by vite preview (no gzip); gzip estimate of JS/CSS is within ~3% (JS is already minified), so compression is not the lever; images/3D are.

## Findings
- Phone root: **13.5 screens, 12 sections**, 12 CTAs in the page body with 11 different labels (Try the Ring Builder / Access my custom audit / Calculate ROI / Call / Call me / Select a package / Start recovering revenue now / View my custom audit / Start concierge rollout / Get a concierge callback / Get Fourcee now ...), plus a fixed bottom dock (Home/Audit, Book, Get Fourcee). The first purchase-path CTA ("Select a package") is at 3.65 screens on phone.
- Phone audit route: **15.7 screens, 14 sections** + intro gate. First "Go live in 2 hours" button at 1.66 screens; the page-closing CTA at 15.2 screens. The "R16 000-R26 000 / month" headline number (the 10-second proof) is at ~2.5 screens on phone and ~1.8 on desktop (section id `audit-lost-revenue`), not in the first view.
- Gates before content: splash 7.8 s (phone root, software GL) / 5.2 s (desktop root); audit intro gate adds a tap on top of ~4.7-4.9 s of load. A "Portal tip" popup (Got it / Don't show again) pops over the page ~2.8 s after load in every view.
- Words in the first view: 93-132 (excluding nothing; includes dock labels, chips, the demo-phone card).
- Weight: 12.7 MB (root) / 20.1 MB (audit) as served on first visit with a full scroll. Biggest items: `nivoda.gif` 5.1 MB, `placeholder.gif` 3.7 MB (loaded twice under two URLs on audit), `gold chatoic sphere/scene.bin` 8.7 MB (the audit intro 3D sphere), `venice_sunset_1k.hdr` 1.1 MB from threejs.org, `ring_webgi.glb` 0.95 MB + draco decoders + webgi bundle 0.53 MB, `workflow5.png` 1.1 MB. 3D/AR-related bytes: 1.3 MB (root) / 2.3 MB (audit) before the 8.7 MB sphere bin.
- Render-blocking third parties in `index.html`: `cdn.tailwindcss.com` runtime script (blocks first paint on a network round trip), Google Fonts CSS, `framerusercontent.com`, jsdelivr (draco). Demo-phone input font-size is 12 px on phone (14 px desktop): iOS Safari zooms on focus (<16 px).
- Layout shift on audit: CLS 0.06-0.09 (above the 0.1 "good" line only barely; flagged for tracking).

## Screenshots (this folder)
- Above the fold: `before-{m,d}-{root,audit}-above-fold.png`
- Whole page as a contact sheet (every scroll position, left to right): `before-{m,d}-{root,audit}-contact-sheet.png`
- Every individual scroll screenshot + first-view-with-overlays: `before/`
