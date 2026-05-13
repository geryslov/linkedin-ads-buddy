## Goal
Show **per-creative impressions / clicks / spend / leads for each matched company** within the existing Influence Matcher drill-down. Numbers will be real (queried from LinkedIn), not estimated.

## Why this works (no dual-pivot violation)
LinkedIn analytics does not allow `pivots=[MEMBER_COMPANY, CREATIVE]` in one query (that's the 500 we already coded around). But it **does** allow `pivot=MEMBER_COMPANY` + filter `creatives[0]=urn:li:sponsoredCreative:{id}`. So we issue **one MEMBER_COMPANY query per creative**, then on the client we already know which company-row each result belongs to.

## UX
After the user runs Influence Matcher and matched companies are identified:

```text
▼ Acme Corp  (impressions, clicks, spend totals)
   ▼ Lead Generation  (objective row — already exists)
       ▼ Campaign A — 12,400 impressions  (already exists)
           • Creative "Q4 Demo Video"        — 8,200 impr · 14 clicks · $42  ← NEW
           • Creative "Q4 Carousel"          — 4,200 impr ·  6 clicks · $19  ← NEW
       ▶ Campaign B
   ▶ Brand Awareness
```

A 4th nesting level under each campaign row, only rendered when that campaign is expanded. Loading skeleton shown until the eager fetch finishes.

## Fetch strategy (Hybrid)
1. Influence Matcher matches finishes → we know the set of matched company URNs and the set of creative IDs already collected by the existing creative probe (the one added in the previous step).
2. Kick off background fetch: for each creative ID, run one paginated `pivot=MEMBER_COMPANY` analytics call filtered to `accounts[0]=...` + `creatives[0]=urn:li:sponsoredCreative:{id}` for the date range.
3. Filter results client-side (or in the edge function) to the matched company URNs only — drop everything else.
4. Run with concurrency cap of 5 to avoid rate-limit spikes. Show progress (`X / N creatives loaded`) in the matcher header.
5. Cache results by `(accountId, dateRange, creativeId)` so re-expanding companies/campaigns is instant.

## Changes

### 1. Edge function — `supabase/functions/linkedin-api/index.ts`
New action `get_creative_company_breakdown`:
- Input: `{ accountId, dateRange, creativeIds: string[], companyUrns: string[] }`
- For each `creativeId`: paginated `pivot=MEMBER_COMPANY` analytics call with `creatives[0]=urn:li:sponsoredCreative:{id}` (raw template string per Rest.li rules).
- Aggregate into `{ [companyUrn]: { [creativeId]: { impressions, clicks, costInLocalCurrency, leads } } }`, dropping company URNs not in the input set.
- Concurrency cap 5, return all results in one response.

### 2. Hook — `src/hooks/useCompanyDemographic.ts`
- Add `creativeCompanyCache: Map<string, Map<string, CreativeMetrics>>` keyed by `companyUrn → creativeId`.
- Add `fetchCreativeCompanyBreakdown(accountId, creativeIds, companyUrns)` that calls the new edge action and populates the cache.
- Add `loadingCreativeBreakdown` boolean and `creativeBreakdownProgress: { loaded, total }` for UI feedback.

### 3. Hook — `src/hooks/useCompanyInfluenceMatcher.ts`
- After matching completes and before/while user explores, trigger `fetchCreativeCompanyBreakdown` with the union of `creativeIds` from matched objectives and the set of matched company URNs.
- Extend `MatchedCampaign` (or add it if it doesn't exist yet at that level) with `creativeBreakdown: Array<{ creativeId, creativeName, impressions, clicks, spent, leads }>`, populated from the cache once it lands.
- Extend `getExportData` to include rows or columns for creative-level breakdown.

### 4. UI — `src/components/dashboard/CompanyInfluenceMatcher.tsx`
- Under each campaign row in the expanded objective view, render a collapsible list of creatives with metrics (uses existing `Collapsible` primitive).
- Show a small skeleton + progress text while `loadingCreativeBreakdown` is true.
- Reuse existing number formatting / chip styles for visual consistency.

### 5. CSV export
- Add a new export option "Include creative breakdown" — when checked, emits one row per (company × objective × campaign × creative) instead of per (company × objective).

## Out of scope
- Per-creative breakdown for **non-matched** companies (covered by hybrid choice).
- Creative thumbnails inside the breakdown rows (we have `CreativeThumbnail` available if you want it later).
- Demographics-tab-wide creative drill-down (this plan is Influence Matcher only).

## Verification
1. Deploy `linkedin-api`.
2. Open Influence Matcher → run a match for an account with several active creatives.
3. Header shows `Loading creative breakdown: 12 / 47…` then disappears.
4. Expand a matched company → expand an objective → expand a campaign → confirm creatives list with non-zero metrics.
5. Confirm sum of per-creative impressions for a (company, campaign) ≈ campaign-level number for that company (small drift OK due to LinkedIn rounding).
6. Edge logs show: `[get_creative_company_breakdown] N creatives × M companies, concurrency=5`.
7. Export CSV with new option enabled → confirm extra rows.