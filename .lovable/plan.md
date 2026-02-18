

# Add Landing Page Clicks to Company Demographic Report

## Overview
Add a "LP Clicks" (Landing Page Clicks) column to the Company Demographic with Website Enrichment report. This metric from LinkedIn's `adAnalyticsV2` API counts clicks that navigate users to the advertiser's landing page, as opposed to social engagement clicks.

## Changes (3 files + 1 edge function)

### 1. Edge Function: `supabase/functions/linkedin-api/index.ts`
- **`get_company_demographic` action (line ~2179):** Add `landingPageClicks` to the `fields` parameter in the API request
- **Aggregation map (line ~2191):** Add `landingPageClicks: number` to the company map type and aggregate it during pagination
- **Output mapping (line ~2535+):** Include `landingPageClicks` in the final response elements

### 2. Hook: `src/hooks/useCompanyDemographic.ts`
- Add `landingPageClicks: number` to:
  - `CompanyDemographicItem` interface (line 41)
  - `ObjectiveBreakdownItem` interface (line 22)
  - `CampaignBreakdownItem` interface (line 5)
- Map the field from API response in `fetchCompanyDemographic` (line 135)
- Add to `totals` computation (line 252)

### 3. Table UI: `src/components/dashboard/CompanyDemographicTable.tsx`
- Add `landingPageClicks` as a sortable column header between "Clicks" and "Spent"
- Display value in each company row, objective breakdown row, and campaign breakdown row
- Include in footer totals row

### 4. Export: `src/lib/exportUtils.ts`
- Add `{ key: 'landingPageClicks', label: 'LP Clicks' }` to `companyDemographicColumns`

## Technical Notes
- `landingPageClicks` is a standard LinkedIn adAnalyticsV2 field -- no special API provisioning required
- The field will be aggregated the same way as `clicks` (summed across time periods per company)
- The objective and campaign breakdown sub-rows will also show LP clicks when available
