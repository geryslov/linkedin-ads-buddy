

# New "Creative Reports" Sidebar Section with Multi-Timeframe View

## Overview

Add a new top-level sidebar tab called "Creative Reports" that displays a single table where each creative (aggregated by name across all campaigns, same as Creative Names Report) shows its CPL, CTR, and Spend for 4 timeframes side-by-side: Last 7 Days, Last 14 Days, Last 30 Days, and Last Month. This lets you spot fatigue at a glance.

## New Files

### 1. `src/hooks/useCreativePerformanceReport.ts`
- New hook that fires 4 parallel calls to the existing `get_creative_names_report` edge function action, one for each timeframe (7d, 14d, 30d, last month).
- Each call uses the same `accessToken` and `accountId`, just different `dateRange` params.
- Groups the 4 result sets by `creativeName` (same aggregation logic as Creative Names Report -- summing impressions, clicks, spent, leads across campaigns for the same creative name).
- Returns a merged array where each entry has metrics for all 4 periods.

### 2. `src/components/dashboard/CreativePerformanceReport.tsx`
- Main component rendered when the "Creative Reports" tab is active.
- Calls the hook on mount / account change.
- Renders a table with columns:
  - **Creative Name** (with thumbnail + expand for campaign breakdown)
  - For each of the 4 timeframes: **CPL**, **CTR**, **Spend**
- Includes search filter and sortable columns.
- Color-coded trend indicators: if CPL is rising or CTR is declining across periods, highlight in red/amber.
- Totals row at the bottom.

## Modified Files

### 3. `src/components/dashboard/Sidebar.tsx`
- Add a new nav item: `{ id: "creative_reports", label: "Creative Reports", icon: TrendingUp }` (or `BarChart3`), placed after "Creatives" in the list.

### 4. `src/pages/Dashboard.tsx`
- Add header title for `creative_reports` tab.
- Render `<CreativePerformanceReport>` when `activeTab === "creative_reports"`.
- Pass `accessToken` and `selectedAccount` as props.

## No Backend Changes Required
The existing `get_creative_names_report` edge function action already supports arbitrary date ranges. We simply call it 4 times in parallel with different date ranges.

## Technical Details

### Data Flow
1. User selects "Creative Reports" tab.
2. Hook fires 4 parallel `supabase.functions.invoke('linkedin-api', { body: { action: 'get_creative_names_report', ... } })` calls.
3. Each returns creative-level data for its timeframe.
4. Client-side: group by `creativeName`, aggregate metrics, merge into a single row per creative with `{ last7d: {cpl, ctr, spend}, last14d: {...}, last30d: {...}, lastMonth: {...} }`.

### Table Layout
```text
Creative Name | 7d CPL | 7d CTR | 7d Spend | 14d CPL | 14d CTR | 14d Spend | 30d CPL | 30d CTR | 30d Spend | LM CPL | LM CTR | LM Spend
```

### Fatigue Indicators
- CPL rising from 7d to 30d: amber/red badge
- CTR declining from 7d to 30d: amber/red badge
- These are calculated client-side by comparing the metric values across timeframes.

