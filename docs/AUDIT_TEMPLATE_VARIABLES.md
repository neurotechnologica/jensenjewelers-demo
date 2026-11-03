# Audit Template Variables (Dynamic Injection Spec)

This document defines every variable that should be dynamic on the audit page so the same template can be reused for any prospect account.

Use this as the source of truth for:

- scraper outputs,
- computed metrics,
- JSON payload shape,
- and UI field mapping.

---

## 1) Top-Level JSON Contract

```json
{
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

---

## 2) `auditMeta`

Fields:

- `generatedDate` (string) - report generation date.
- `reportId` (string) - internal tracking id.
- `confidentialityLabel` (string) - e.g. "Confidential audit brief".
- `preparedForLabel` (string) - e.g. "Specially Prepared for {business}".
- `currencyCode` (string) - e.g. `USD`, `GBP`, `ZAR`.
- `locale` (string) - formatting locale, e.g. `en-US`.

Used in:

- splash screen
- header pills
- any money/date formatting helpers

---

## 3) `business`

Fields:

- `name` (string) - showroom/business name.
- `location` (string) - city/area/location string.
- `logoUrl` (string) - client logo path/url.
- `heroImageUrl` (string) - scraped storefront / business cover image for the audit brief intro hero (sphere section). Does not replace `logoUrl` or `recoveryPlan.supportingMediaUrl`.
- `industry` (string) - primary vertical (e.g. luxury jewelry retailer).
- `storeCount` (number) - number of locations.
- `teamSize` (number) - optional staffing context.
- `website` (string) - business domain.
- `primaryPhone` (string) - audit target number.

Used in:

- fixed header
- hero title/subtitle
- audit brief intro hero background (`heroImageUrl`)
- "prepared for" copy
- recovery plan copy where relevant

---

## 4) `reviews`

Fields:

- `rating` (number) - average rating (e.g. 4.9).
- `count` (number) - review count.
- `starsDisplay` (string) - optional display string, default `"★★★★★"`.
- `quote1` (string) - representative sentiment quote.
- `quote2` (string) - representative sentiment quote.
- `themes` (string[]) - key complaint/praise themes.

Used in:

- hero review strip
- GBP snapshot card

---

## 5) `traffic`

Fields:

- `sources` (array):
  - `label` (string)
  - `percent` (number)
  - `colorKey` (string, enum like `search|website|direct`)

Example:

```json
{
  "sources": [
    { "label": "Google Search", "percent": 68, "colorKey": "search" },
    { "label": "Website", "percent": 22, "colorKey": "website" },
    { "label": "Direct / Other", "percent": 10, "colorKey": "direct" }
  ]
}
```

Used in:

- "Where your calls are coming from" pie chart + legend

Validation:

- percentages should sum to 100

---

## 6) `callModel`

Fields:

- `inboundCallsPerWeekMin` (number)
- `inboundCallsPerWeekMax` (number)
- `answerRateMin` (number, percentage)
- `answerRateMax` (number, percentage)
- `missedCallsPerWeekMin` (number)
- `missedCallsPerWeekMax` (number)
- `answeredCallsPerWeekMin` (number)
- `answeredCallsPerWeekMax` (number)
- `missedCallTypeSplit` (array):
  - `label` (string)
  - `percent` (number)

Used in:

- hero metric pills
- key findings cards
- bar chart
- missed-call donut chart

---

## 7) `revenueModel`

Fields:

- `monthlyLossMin` (number)
- `monthlyLossMax` (number)
- `monthlyLossMidpoint` (number)
- `sixMonthCumulativeLeak` (number)
- `lineSeries` (number[]) - month-by-month cumulative values.
- `currencySymbol` (string) - e.g. `$`.

Used in:

- revenue impact section
- leak line chart
- "what this means" copy
- final CTA statement

---

## 8) `breakdown`

Fields:

- `rows` (array):
  - `callType` (string)
  - `weeklyMissedMin` (number)
  - `weeklyMissedMax` (number)
  - `monthlyImpactMin` (number)
  - `monthlyImpactMax` (number)
- `riskBadge` (string) - e.g. "High-intent calls at risk".
- `opportunityCards` (array):
  - `title` (string)
  - `subtitle` (string)
  - `valueNote` (string)
  - `impactTier` (string, e.g. `$`, `$$`, `$$$`)
  - `mobileWidthPercent` (number) - used for impact taper on mobile.

Used in:

- breakdown table
- opportunity map cards below table

---

## 9) `comparison`

Fields:

- `currentAnsweredRate` (number)
- `currentMonthlyLoss` (number)
- `projectedAnsweredRate` (number)
- `projectedMonthlyLoss` (number)
- `comparisonFootnote` (string)

Used in:

- before/after comparison cards

---

## 10) `projection90d`

Fields:

- `answerRateProjected` (string) - e.g. `"98-100%"`.
- `monthlyRecoveredProjected` (string) - formatted range.
- `paybackPeriodProjected` (string) - e.g. `"42-58 days"`.
- `barWidths` (object) - UI widths for progress bars:
  - `answerRate`
  - `monthlyRecovered`
  - `paybackPeriod`

Used in:

- projected results section

---

## 11) `recoveryPlan`

Fields:

- `headline` (string)
- `body` (string)
- `capabilities` (string[]) - optional bullet list if expanded later.
- `supportingMediaUrl` (string) - e.g. Nivoda gif/video.

Used in:

- recovery plan section

---

## 12) `liveDemo`

Fields:

- `ctaLabel` (string) - e.g. "Try Fourcee on your phone".
- `helperCopy` (string)
- `phoneCountryDefault` (string) - e.g. `+1`.
- `demoDurationHint` (string) - e.g. `~60–90s`.

Used in:

- live demo block + mini phone context copy

---

## 13) `branding`

Fields:

- `theme`:
  - `primary` (hex)
  - `secondary` (hex)
  - `accentGold` (hex)
  - `accentSilver` (hex)
- `logoWordmarkUrl` (string)
- `clientLogoUrl` (string)
- `fontHeading` (string)
- `fontBody` (string)

Used in:

- palette-driven gradients
- logos
- typography tokens

---

## 14) `compliance`

Fields:

- `dataSourceLine` (string) - footer source attribution.
- `disclaimerShort` (string)
- `disclaimerLong` (string)
- `allowedClaims` (string[]) - claim guardrails.

Used in:

- section trust footer
- legal/confidence copy blocks

---

## 15) Dynamic UI Mapping Checklist (By Section)

### Splash Screen

- `auditMeta.confidentialityLabel`
- `auditMeta.preparedForLabel`
- `business.name`

### Fixed Header

- `business.logoUrl`
- `business.name`
- `business.location`
- `auditMeta.generatedDate`

### Hero

- `reviews.rating`
- `reviews.count`
- `callModel.inboundCallsPerWeek*`
- `callModel.answerRate*`
- `callModel.missedCallsPerWeek*`

### Methodology

- `reviews.count`
- `business.industry`
- localized benchmark/source references

### Key Findings

- call summary metrics from `callModel`

### Revenue Impact

- `revenueModel.monthlyLossMin`
- `revenueModel.monthlyLossMax`
- `revenueModel.monthlyLossMidpoint`

### Charts

- bar chart from `callModel`
- donut from `callModel.missedCallTypeSplit`
- line chart from `revenueModel.lineSeries`
- traffic pie + legend from `traffic.sources`

### Breakdown Table + Opportunity Map

- `breakdown.rows`
- `breakdown.opportunityCards`

### What This Means

- `revenueModel.monthlyLossMin/max`
- behavioral framing text from `comparison` or dedicated copy field

### 90-Day Projection

- `projection90d.*`

### Recovery Plan

- `recoveryPlan.*`

### Final CTA

- final loss statement from `revenueModel`
- CTA labels from `liveDemo` / conversion config

---

## 16) Recommended Data Pipeline (Scrape -> Compute -> Inject)

1. **Scrape**
   - reviews, rating, count, business profile metadata.
2. **Normalize**
   - clean names/locations, standardize currency and locale.
3. **Model**
   - infer call volume, answer-rate range, loss model, per-category split.
4. **Generate JSON**
   - output the contract in this file.
5. **Render**
   - bind JSON into audit template props and chart datasets.
6. **Validate**
   - number ranges, totals (percent=100), non-empty legal attribution.

---

## 17) Must-Validate Rules Before Publishing Any Client Audit

- `traffic.sources[].percent` totals 100.
- Every currency value uses `auditMeta.currencyCode` + `auditMeta.locale`.
- Monthly/annual pricing language does not conflict with commercial policy.
- Review quotes are real, public, and compliant with platform policy.
- No placeholder company name/logo remains in production output.
- Final CTA and loss claims match the computed model source.

