# Fix-sprint evidence (PR #18)

Before is the live prospect site, [fourcee.lutho.app/?v=full](https://fourcee.lutho.app/?v=full), which still shows the critique bugs. After is this branch’s production build, served locally and opened at `http://127.0.0.1:4173/?v=full`:

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Captured in headless Chrome. Desktop is 1280×900. Mobile is 390×844. `PLACEHOLDER Business` and `City, State` were not edited. No merge and no production deploy.

Raw probe output is `measurements.json` in this folder.

## Load times

Splash on-screen time is from when `[data-testid=splash]` mounts until it unmounts. The budget in the brief is under 1.5s. Hero/3D first frame is when the hero poster hides (desktop) or `[data-testid=ring-poster]` flips to `data-ready="1"` (mobile, after the studio is scrolled into view). That signal fires once the app has drawn a frame. There is no separate 3D budget in the brief; PASS means a frame was painted.

| Check | Before (live) | After (this branch) | Result |
| --- | ---: | ---: | --- |
| Desktop splash on screen | 3706 ms | 1360 ms | **PASS** (< 1500 ms) |
| Mobile splash on screen | 3631 ms | 1354 ms | **PASS** (< 1500 ms) |
| Desktop intro (navigation → splash gone) | 4787 ms | 1836 ms | recorded (see note) |
| Mobile intro (navigation → splash gone) | 5125 ms | 1836 ms | recorded (see note) |
| Desktop hero/3D first frame from navigation | not observed within 20 s | 5505 ms | **PASS** (frame painted) |
| Desktop hero/3D first frame after splash | — | 3669 ms | **PASS** (frame painted) |
| Mobile hero/3D first frame from navigation | 9098 ms | 4874 ms | **PASS** (frame painted) |
| Mobile hero/3D first frame after splash | 3973 ms | 3037 ms | **PASS** (frame painted) |
| Desktop first contentful paint | 1212 ms | 536 ms | recorded |
| Mobile first contentful paint | 1608 ms | 532 ms | recorded |

The splash itself is under 1.5s (about 900 ms hold + 350 ms fade, measured 1354–1360 ms, and the after splash has a Skip control). Navigation-to-gone is 1836 ms because the splash does not mount until the bundle has evaluated (~480 ms on this local preview, which is uncompressed and not on a CDN).

3D first frame is a few seconds after the splash on this headless Chrome. It does paint. It is not under 1.5s.

## Checklist

| Blocker | Before | After | Result |
| --- | --- | --- | --- |
| Checkout invoice step | Heading “Invoice & Wise handoff”. Body includes `VITE_WISE_PAYMENT_URL` and “No fake PCI vault”. | Heading “Request your invoice”. Those strings are absent. | **PASS** |
| ROI badge | “ROI in 0.0 Months” at the default sliders. | “ROI in under 1 month”. | **PASS** |
| Side-menu deal | Label “Average deal value: $4,200” while the range value is 4250 (step 250). | Label “$4,250” and range value 4250. | **PASS** |
| Audit lead gate | “Skip phone · view report” opens the report with no name, email, or phone. | Name, email, and phone are on screen before the report. `PLACEHOLDER Business` and `City, State` still show. | **PASS** |
| Mobile audit phone | Phone field sits in the report with no lead gate. | After the gate, the phone field is in its own card under the ring mockup. | **PASS** |
| Audit date / report chip | Live report still uses the old intro. | Expanded header reads “Generated October 10, 2026” (visit date). No “April 15, 2026” and no “REPORT PLACEHOLDER”. | **PASS** |
| Splash under 1.5s | 3.6–3.7 s, no Skip. | 1.35–1.36 s, Skip visible. | **PASS** |
| Dock vs footer disclaimer | Overlap area 0. Gap 34 px desktop, 38 px mobile. | Overlap area 0. Gap 86 px desktop, 89 px mobile. | **PASS** |

The live footer disclaimer was already clear of the dock at these two viewports (a few dozen pixels). This branch’s clearance (`dock bottom + dock height + 6rem`) increases that gap. The dock does not cover the disclaimer on the after build.

## Screenshots

Desktop pairs unless noted.

- Checkout: `before-desktop-checkout-invoice.png`, `after-desktop-checkout-invoice.png` (mobile: `before-mobile-checkout-invoice.png`, `after-mobile-checkout-invoice.png`)
- ROI: `before-desktop-roi-badge.png`, `after-desktop-roi-badge.png` (mobile: `before-mobile-roi-badge.png`, `after-mobile-roi-badge.png`)
- Side menu: `before-desktop-side-menu-deal.png`, `after-desktop-side-menu-deal.png`, plus the label crops `before-desktop-deal-label.png` (`$4,200`) and `after-desktop-deal-label.png` (`$4,250`)
- Audit gate: `before-mobile-audit-intro.png`, `after-mobile-audit-lead-gate.png` (desktop gate: `after-desktop-audit-lead-gate.png`)
- Audit phone: `before-mobile-audit-phone-input.png`, `after-mobile-audit-phone-layout.png`
- Visit date: `after-mobile-audit-report-date.png`
- Splash: `before-desktop-splash.png`, `after-desktop-splash.png`, `before-mobile-splash.png`, `after-mobile-splash.png`
- Footer and dock: `before-desktop-footer-dock.png`, `after-desktop-footer-dock.png`, `before-mobile-footer-dock.png`, `after-mobile-footer-dock.png`
