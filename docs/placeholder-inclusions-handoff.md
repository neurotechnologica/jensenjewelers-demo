# Placeholder Wiring Handoff

This document lists all placeholder inclusions in the current source code that should be wired to real business data that comes in.

Baseline comparison source: `oldapptsx.example`.

## Scope used

- Included: `App.tsx`, `components/**/*`, `public/content.json`
- Excluded: build output (`dist/*`) and dependencies (`node_modules/*`)

## Placeholders to wire

- `public/content.json`
  - `auditMeta.reportId`: `"PLACEHOLDER"`
  - `business.name`: `"PLACEHOLDER Business"`
  - Notes:
    - `business.name` is the main identity source for multiple UI surfaces.
    - `reviews` and `traffic.sources` already exist in this file and can be used as data sources where needed.

- `App.tsx`
  - Fallback value for business identity:
    - `auditData?.business.name ?? 'PLACEHOLDER Business'`
  - Used for:
    - global `businessName` derivation
    - `CRMView` prop fallback

- `components/CheckoutFlow.tsx`
  - Local fallback state:
    - `useState('PLACEHOLDER Business')`
  - Guard condition:
    - `current !== 'PLACEHOLDER Business'`
  - Wiring intent:
    - overwritten by `content.json -> business.name` when available

- `components/CRMView.tsx`
  - Prop default:
    - `businessName = 'PLACEHOLDER Business'`
  - Wiring intent:
    - pass real business name from parent (`App.tsx`)

- `components/ValueCalculator.tsx`
  - Prop default:
    - `businessName = 'PLACEHOLDER Business'`
  - Wiring intent:
    - pass real business name from parent where component is rendered

- `components/ui/mini-phone.tsx`
  - Prop default:
    - `businessName = 'PLACEHOLDER Business'`
  - Wiring intent:
    - pass real business name from parent where component is rendered

- `components/AuditPage.tsx`
  - GBP review display placeholders:
    - now consumed via `GBP_PLACEHOLDER_TOKENS` from `components/audit-placeholders.ts`
  - Wiring intent:
    - replace with real review values (or remove placeholders and bind directly to a single data source)
  - Status:
    - old duplicated inline constants were replaced

- `components/AuditCharts.tsx`
  - GBP review display placeholders:
    - now consumed via `GBP_PLACEHOLDER_TOKENS` from `components/audit-placeholders.ts`
  - Wiring intent:
    - replace with real review values (or consume centralized review placeholders/values)
  - Status:
    - old duplicated inline constants were replaced

- `components/audit-placeholders.ts` (canonical GBP placeholder source)
  - `GBP_PLACEHOLDER_TOKENS.stars`: `'PLACEHOLDER_REVIEW_STARS'`
  - `GBP_PLACEHOLDER_TOKENS.ratingOutOf5`: `'PLACEHOLDER_RATING_OUT_OF_5'`
  - `GBP_PLACEHOLDER_TOKENS.reviewsCount`: `'PLACEHOLDER_REVIEWS_COUNT'`
  - Wiring intent:
    - single source-of-truth for temporary GBP placeholder strings shared by audit components

## wiring map

- Business identity:
  - single source: `public/content.json -> business.name`
  - inject via `App.tsx` props into:
    - `CRMView`
    - `ValueCalculator`
    - `MiniPhone`
    - `CheckoutFlow` initialization fallback

- GBP review block:
  - canonical placeholder source: `components/audit-placeholders.ts`
  - preferred source: `public/content.json -> reviews`
    - `starsDisplay`
    - `rating`
    - `count`
  - apply consistently in both:
    - `components/AuditPage.tsx`
    - `components/AuditCharts.tsx`

- Report metadata:
  - source: `public/content.json -> auditMeta.reportId`
  - replace `"PLACEHOLDER"` with generated/report-specific ID.

Feel free to wire it up however you see fit, im not rigid in terms of implmentation. This wass just to visualise it for myself.

In a bit,
