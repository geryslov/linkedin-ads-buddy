

# Add Objective Breakdown to Company Demographic Report

## Overview

Each company row in the Company Demographic table will become expandable. When clicked, it reveals a sub-table showing how that company's metrics break down by campaign objective (e.g., Lead Generation, Engagement, Brand Awareness, Website Visits).

## How It Works

The LinkedIn Analytics API uses a `MEMBER_COMPANY` pivot to show which companies saw your ads. Currently, this is fetched at the account level, producing one row per company with aggregated totals.

To add an objective breakdown, the backend will:
1. Fetch all campaigns for the account to build a mapping of campaign ID to objective type
2. For each unique objective, make a separate analytics query filtered to only the campaigns with that objective
3. Return the per-objective data alongside the aggregated company data

The frontend will render expandable rows: click a company to see its metrics split by objective.

## Changes

### 1. Backend: Edge Function Enhancement

**File:** `supabase/functions/linkedin-api/index.ts` (within `get_company_demographic` action)

After the existing company-level aggregation (Step 1), add:

- **Fetch campaign metadata**: Call `adCampaignsV2` API to get all campaigns and their `objectiveType`
- **Group campaigns by objective**: Create a map of objective type to campaign IDs
- **Per-objective analytics queries**: For each objective group, make a separate `adAnalyticsV2` call with `pivot=MEMBER_COMPANY` filtered to those campaigns
- **Attach breakdown to each company**: Each company in the response gets a new `objectiveBreakdown` array field

The response structure per company will change from:
```
{ entityName, impressions, clicks, spent, leads, ... }
```
to:
```
{
  entityName, impressions, clicks, spent, leads, ...,
  objectiveBreakdown: [
    { objective: "LEAD_GENERATION", impressions: 500, clicks: 20, spent: 150, leads: 5 },
    { objective: "ENGAGEMENT", impressions: 300, clicks: 45, spent: 80, leads: 0 },
  ]
}
```

### 2. Frontend: Data Model Update

**File:** `src/hooks/useCompanyDemographic.ts`

- Add a new `ObjectiveBreakdownItem` interface with fields: `objective`, `impressions`, `clicks`, `spent`, `leads`, `ctr`, `cpc`, `cpm`
- Add `objectiveBreakdown` field to `CompanyDemographicItem` interface
- Map the new field from the API response

### 3. Frontend: Expandable Table Rows

**File:** `src/components/dashboard/CompanyDemographicTable.tsx`

- Make each company row clickable to expand/collapse
- Add a chevron icon indicator (right/down) to show expand state
- When expanded, show a sub-table below the company row with one row per objective
- Each objective row displays: objective name (formatted nicely), impressions, clicks, spent, leads, CTR, CPC, CPM
- Sub-rows are styled with a slightly indented/lighter background to visually distinguish them from parent rows
- Objective names are formatted for readability (e.g., "LEAD_GENERATION" becomes "Lead Generation")

## Technical Details

### API Call Strategy

Rather than making one query per objective (which could be slow with many objectives), the approach groups campaigns by objective first:

```text
Step 1: Fetch campaigns -> { LEAD_GENERATION: [c1, c2], ENGAGEMENT: [c3, c4], BRAND_AWARENESS: [c5] }
Step 2: For each objective group, query adAnalyticsV2 with MEMBER_COMPANY pivot + campaign filter
Step 3: Merge results into per-company breakdown arrays
```

Typically there are only 2-4 unique objectives per account, so this adds 2-4 extra API calls -- a minimal overhead.

### Safety Measures

- If the campaign metadata fetch fails, the report still works as before (just without the breakdown)
- Empty objective breakdowns (all-zero metrics for a company under an objective) are filtered out
- The expanded view only shows objectives that have actual data for that company

## Files to Modify

1. `supabase/functions/linkedin-api/index.ts` -- Add objective grouping and per-objective queries to `get_company_demographic`
2. `src/hooks/useCompanyDemographic.ts` -- Add `ObjectiveBreakdownItem` interface and map new field
3. `src/components/dashboard/CompanyDemographicTable.tsx` -- Add expandable rows with objective breakdown sub-table

