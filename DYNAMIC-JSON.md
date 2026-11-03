# Dynamic JSON contract (Neuro generator)

**Wiring source of truth:** Neuro-generated client audits from `neurotechnologica` (the private `fourcee-template` repo is the intended contract; this file documents the live injection surface Neuro actually writes).

**UX source of truth:** `apollo-xwb/fourcee-template` visual/product progress — ported only where it does not rename, drop, or conflict with the keys below.

The private `neurotechnologica/fourcee-template` repository was not readable from this agent token (`404` / `Repository not found`). The contract below is reconstructed from Neuro’s **published generated demos** (April → July 2026) plus the founder template docs (`docs/AUDIT_TEMPLATE_VARIABLES.md`). Field names match those generated files exactly.

---

## Load path (do not change)

| Step | What | Why |
| --- | --- | --- |
| 1 | `GET /content.json` (`cache: 'no-store'`) | Neuro overwrites `public/content.json` per client at generate time |
| 2 | Parse as `AuditData` (`types/audit.ts`) | Same key names the generator writes |
| 3 | `normalizeAuditData()` fills **missing optional** fields only | Never renames keys; never requires apollo-only extras |

Implementation: `lib/audit-content.ts`  
Callers: `App.tsx`, `components/CheckoutFlow.tsx`

There is **no** `window.__*` injection, **no** env-based content URL, and **no** alternate JSON filename. Do not add one without updating Neuro.

---

## Placeholder tokens Neuro may string-replace

Keep these exact literals in repo (values and/or source tokens):

| Token | Where |
| --- | --- |
| `PLACEHOLDER Business` | `content.json` → `business.name`; JS fallbacks in App / Checkout / CRM / MiniPhone / ValueCalculator |
| `PLACEHOLDER` | `content.json` → `auditMeta.reportId` |
| `PLACEHOLDER_REVIEW_STARS` | `components/audit-placeholders.ts` |
| `PLACEHOLDER_RATING_OUT_OF_5` | `components/audit-placeholders.ts` |
| `PLACEHOLDER_REVIEWS_COUNT` | `components/audit-placeholders.ts` |

`lead_id` is optional. Older April demos omit it; July+ demos and voice-demo webhooks include it.

---

## Top-level JSON shape (generator writes this)

```json
{
  "lead_id": "optional-uuid",
  "auditMeta": {},
  "business": {},
  "reviews": {},
  "traffic": {},
  "callModel": {},
  "revenueModel": {},
  "breakdown": {},
  "comparison": {},
  "projection90d": {},
  "recoveryPlan": {},
  "liveDemo": {},
  "branding": {},
  "compliance": {}
}
```

### Field map (names frozen)

**`auditMeta`:** `generatedDate`, `reportId`, `confidentialityLabel`, `preparedForLabel`, `currencyCode`, `currencySymbol`, `locale`

**`business`:** `name`, `location`, `logoUrl`, `industry`, `storeCount`, `teamSize`, `website`, `primaryPhone`  
**Optional apollo-only (must not be required):** `heroImageUrl` — fallback is `branding.clientLogoUrl` then `business.logoUrl`

**`reviews`:** `rating`, `count`, `starsDisplay`, `quote1`, `quote2`, `themes[]`

**`traffic.sources[]`:** `label`, `percent`, `colorKey` (percents should sum to 100)

**`callModel`:** `inboundCallsPerWeekMin/Max`, `answerRateMin/Max`, `missedCallsPerWeekMin/Max`, `answeredCallsPerWeekMin/Max`, `missedCallTypeSplit[]` (`label`, `percent`)

**`revenueModel`:** `monthlyLossMin/Max`, `monthlyLossMidpoint`, `sixMonthCumulativeLeak`, `lineSeries[]`

**`breakdown`:** `rows[]` (`callType`, `weeklyMissedMin/Max`, `monthlyImpactMin/Max`), `riskBadge`, `opportunityCards[]` (`title`, `subtitle`, `valueNote`, `impactTier`, `mobileWidthPercent`)

**`comparison`:** `currentAnsweredRate`, `currentMonthlyLoss`, `projectedAnsweredRate`, `projectedMonthlyLoss`, `comparisonFootnote`

**`projection90d`:** `answerRateProjected`, `monthlyRecoveredProjected`, `paybackPeriodProjected`, `barWidths.{answerRate,monthlyRecovered,paybackPeriod}`  
`barWidths` values are Tailwind width class strings (e.g. `w-[99%]`). Do not convert them to numbers.

**`recoveryPlan`:** `headline`, `body`, `capabilities[]`, `supportingMediaUrl`

**`liveDemo`:** `ctaLabel`, `helperCopy`, `phoneCountryDefault`, `demoDurationHint`  
Optional: `liveDemo.ringBuilder` (alias of top-level `ringBuilder`). `normalizeAuditData` spreads `liveDemo` so this alias is not stripped.

**`ringBuilder` (optional, new — old payloads omit it and still work):**
- `enabled` (boolean) — `false` hides the studio; missing/`true` shows it with defaults
- `headline`, `subhead`
- `metals[]` / `gems[]`: `{ id, label, color }`
- `defaultMetalId`, `defaultGemId`

Code defaults live in `lib/ring-builder.ts`. Neuro can personalize later without a schema migration.

### Toggle / configure the ring studio

| Goal | JSON |
| --- | --- |
| Show with defaults | omit `ringBuilder`, or `"ringBuilder": { "enabled": true }` |
| Hide | `"ringBuilder": { "enabled": false }` |
| Personalize copy | `"headline"`, `"subhead"` |
| Personalize swatches | `"metals"` / `"gems"` arrays of `{ id, label, color }` |
| Alias | same object under `liveDemo.ringBuilder` (top-level wins if both exist) |

Placement: landing `#ring-studio` (lazy IntersectionObserver + `React.lazy`) and Fourcee ops → Studio (compact).  
Implementation: Three.js + local Draco (`/draco/gltf/`) loads the 3D-app ring GLB (`public/assets/3D/ring_webgi.glb`, `KHR_draco_mesh_compression`). Ports **only** scroll-camera, rotation, and metal/gem build. WebGI, their site chrome, and audio are not vendored. The voice agent is the SOP — the studio is merchandising.

Visual chrome (landing / audit / portal / ring studio / pricing) is CSS-only. It does **not** add or rename JSON keys. Omit-key still keeps April Neuro payloads working.

**`branding`:** `theme.{primary,secondary,accentGold,accentSilver}`, `logoWordmarkUrl`, `clientLogoUrl`, `fontHeading`, `fontBody`

**`compliance`:** `dataSourceLine`, `disclaimerShort`, `disclaimerLong`, `allowedClaims[]`

---

## Diff: apollo-xwb vs Neuro-generated wiring

| Item | Neuro (generated audits) | apollo-xwb (before this branch) | Resolution |
| --- | --- | --- | --- |
| Fetch URL | `/content.json` | `/content.json` | Preserved |
| Top-level keys | As above (`lead_id` optional) | Same + optional `business.heroImageUrl` | `heroImageUrl` stays **optional** |
| `auditMeta.generatedDate` / `reportId` | Injected; older template rendered date | Present in JSON, not shown | Re-bound in audit header |
| `recoveryPlan.body` | Injected; older template rendered it | Present, unused (hardcoded copy) | Re-bound |
| `reviews.quote1/quote2/themes` | Injected; older GBP card showed quotes | Typed + passed, quotes not rendered | Re-bound |
| `liveDemo.*` | Injected | Typed, MiniPhone copy hardcoded; audit MiniPhone omitted `lead_id` | Re-bound + `lead_id` passed |
| `compliance.disclaimerShort/Long` | Injected | Only `dataSourceLine` shown | Short disclaimer restored |
| `branding.clientLogoUrl` | Injected | Unused fallback | Used if `logoUrl` empty |
| Placeholder tokens | File + `PLACEHOLDER Business` | Same file, unused imports | Tokens kept; JSON preferred |
| Billing / packages | N/A (not JSON) | `constants.tsx` PACKAGES | **Unchanged** |

No generator-facing key was renamed.

---

## Voice demo webhook (not JSON schema, but per-client)

`MiniPhone` POSTs to `https://app.fourcee.online/webhook/voice-demo-request` with `{ phone_number, lead_id }`.  
`lead_id` comes from `content.json` → `lead_id`.

---

## Founder taste-check before re-upload to Neurotech

1. Replace `public/content.json` with a real generated payload (or a July Neuro audit file) and confirm every number/name/quote updates — including quotes, recovery body, live-demo labels, and header date/report id.
2. Confirm a payload **without** `heroImageUrl` and **without** `lead_id` still renders (April-era files).
3. Confirm `projection90d.barWidths` still paint (they are class strings).
4. Confirm checkout still computes: monthly = setup + first month + add-ons; annual = yearly (setup waived). **No pricing math was changed** (`constants.tsx` PACKAGES / UPSELLS / yearlyPrice / setup waiver unchanged).
5. Do not point Neuro at a different JSON path or rename any key in this file.
