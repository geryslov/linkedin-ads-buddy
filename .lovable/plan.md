
# Speed Up Company Demographic Report

## Problem

The report is slow because it queries **every campaign individually** with the MEMBER_COMPANY pivot (batches of 5). If an account has 50 campaigns, that's 10 sequential batch rounds of LinkedIn API calls -- all before the report can load.

## Solution: Two-Phase Architecture

Split the work into a fast initial load and lazy on-demand loading:

**Phase 1 (initial load -- fast):** Fetch company data + objective-level breakdown only. Instead of querying each campaign individually, query once per **objective group** (all campaigns sharing the same objective in a single query). Accounts typically have 2-4 unique objectives, so this means 2-4 API calls instead of 50+.

**Phase 2 (on-demand -- lazy):** When a user clicks to expand an objective row, fetch the campaign-level breakdown for just that objective's campaigns at that point. This defers the expensive per-campaign work until it's actually needed.

Additionally, run name resolution (Step 2/3) in parallel with the objective breakdown queries (Step 4), since they are independent.

## Changes

### 1. Edge Function: Optimize `get_company_demographic`

**File:** `supabase/functions/linkedin-api/index.ts`

Current Step 4 (the bottleneck):
- Fetches campaign metadata
- Queries EACH campaign individually with MEMBER_COMPANY pivot, batches of 5
- Builds both objective AND campaign breakdown

New Step 4:
- Fetches campaign metadata (same)
- Queries per-OBJECTIVE GROUP (not per-campaign): one API call per unique objective, with all campaigns of that objective as filters
- Builds objective-level breakdown only (no campaign breakdown)
- Remove the `campaignBreakdownMap` entirely from this action

Also parallelize: Run Steps 2+3 (name resolution) and Step 4 (objective breakdown) concurrently using `Promise.all`, since they don't depend on each other.

### 2. Edge Function: New `get_company_campaign_breakdown` action

**File:** `supabase/functions/linkedin-api/index.ts`

Add a new lightweight action that accepts:
- `accountId`, `dateRange`, `campaignIds` (for that objective), `campaignNames` (map)

It queries each campaign individually (batches of 5, same as today) but only for the specific objective being expanded -- typically 5-15 campaigns, not 50+. Returns an array of `{ campaignId, campaignName, impressions, clicks, spent, leads, ctr, cpc, cpm }` per company URN.

### 3. Hook: Add lazy loading function

**File:** `src/hooks/useCompanyDemographic.ts`

- Remove `campaignBreakdown` from the initial data mapping (it won't be in the response anymore)
- Add a new `fetchCampaignBreakdown` function that calls the new edge function action
- Add state to store lazily-loaded campaign breakdowns per company+objective key
- Add a `loadingObjectives` state (Set of keys) so the UI can show a spinner

### 4. Frontend: Trigger lazy load on objective expand

**File:** `src/components/dashboard/CompanyDemographicTable.tsx`

- When expanding an objective row, call `fetchCampaignBreakdown` if data isn't already loaded
- Show a small loading spinner in the campaign area while fetching
- Once loaded, display campaign rows as before
- Cache the loaded data so re-expanding doesn't re-fetch

## Performance Impact

| Scenario | Before | After |
|---|---|---|
| 50 campaigns, 3 objectives | ~10 sequential batch rounds | 3 parallel API calls |
| Initial load API calls | N campaigns / 5 per batch | N objectives (2-4) |
| Name resolution | Sequential after analytics | Parallel with objective queries |
| Campaign drill-down | Pre-loaded (slow) | On-demand (instant feel) |

Expected improvement: initial load time reduced by roughly 80-90% for typical accounts.

## Technical Details

### Per-objective query (replacing per-campaign)

Instead of:
```
// OLD: One query per campaign
campaigns[0]=urn:li:sponsoredCampaign:123  (query 1)
campaigns[0]=urn:li:sponsoredCampaign:456  (query 2)
...50 more queries
```

Now:
```
// NEW: One query per objective group
campaigns[0]=urn:li:sponsoredCampaign:123&campaigns[1]=urn:li:sponsoredCampaign:456&...  (all Lead Gen campaigns in 1 query)
campaigns[0]=urn:li:sponsoredCampaign:789&campaigns[1]=...  (all Engagement campaigns in 1 query)
```

This gives us per-company metrics broken down by objective without needing individual campaign queries.

### Lazy load contract

The `fetchCampaignBreakdown` function will accept:
- `accountId`, `dateRange`, `objectiveCampaignIds` (campaign IDs for one objective)

It returns a map of `companyUrn -> campaignMetrics[]`, which gets merged into the existing data.

### Query tunneling safety

Since per-objective queries may include many campaign URNs, the existing query tunneling fallback (POST with `X-HTTP-Method-Override: GET`) will be used if the URL exceeds length limits.

## Files to Modify

1. `supabase/functions/linkedin-api/index.ts` -- Restructure Step 4 to per-objective queries, add `get_company_campaign_breakdown` action
2. `src/hooks/useCompanyDemographic.ts` -- Add lazy loading function and state
3. `src/components/dashboard/CompanyDemographicTable.tsx` -- Trigger lazy load on objective expand, show loading indicator
