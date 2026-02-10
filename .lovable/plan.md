

# Mega Budget Pacing Dashboard (Lightweight)

## Overview

A new "Budget Pacing" tab showing all ad accounts at a glance with their **account name**, monthly budget, total spend, and pacing status. Uses a lightweight edge function action that fetches only essential data -- no daily breakdowns, no trends, no recommendations.

## Changes

### 1. Edge Function: Add `get_budget_pacing_summary` action

**File:** `supabase/functions/linkedin-api/index.ts`

Accepts an array of account IDs. For each account (in parallel via `Promise.allSettled`):
- One `adAnalyticsV2` call with `timeGranularity=MONTHLY`, `pivot=ACCOUNT` -- single row with total spend
- One database query to fetch budget from `account_budgets`
- Calculate pacing status from spend + budget + current day of month

Returns: `Array<{ accountId, budget, spent, currency, pacingPercent, pacingStatus, daysRemaining, daysInMonth, projected, avgDaily }>`

Skips: daily arrays, 7-day trends, recommendations, projected breakdowns.

### 2. New Hook: `src/hooks/useMegaBudgetPacing.ts`

- Calls `get_budget_pacing_summary` with all account IDs
- Stores results as array of per-account pacing summaries
- Provides `saveBudget` and `refetch`
- Computes aggregate totals (total budget, total spent, pacing distribution)

### 3. New Component: `src/components/dashboard/MegaBudgetPacingDashboard.tsx`

Receives `accessToken` and `adAccounts` (which include `id` and `name`).

**Summary cards:** Total budget, total spent, overall pacing %, accounts on track / over / under.

**Account table** -- each row uses the **account name** (from the `adAccounts` array, matched by ID):
- Account name (not ID)
- Monthly budget (inline editable)
- Total spent
- Pacing status badge (green/yellow/red)
- Pacing % with mini progress bar
- Projected month-end spend
- Days remaining

Sortable by pacing status so problem accounts surface first.

### 4. Sidebar: Add nav item

**File:** `src/components/dashboard/Sidebar.tsx`
- Add `{ id: "budget_pacing", label: "Budget Pacing", icon: Wallet }` after "Analytics"

### 5. Dashboard: Wire up tab

**File:** `src/pages/Dashboard.tsx`
- Render `MegaBudgetPacingDashboard` for `activeTab === "budget_pacing"`
- Pass `accessToken` and `adAccounts`
- Add header text "Budget Pacing"

## Performance

All accounts fetched in parallel with MONTHLY granularity (1 row per account instead of ~30 daily rows). A 10-account dashboard loads in ~1-2 seconds.

## Files

1. **Modify** `supabase/functions/linkedin-api/index.ts` -- Add `get_budget_pacing_summary`
2. **Create** `src/hooks/useMegaBudgetPacing.ts`
3. **Create** `src/components/dashboard/MegaBudgetPacingDashboard.tsx`
4. **Modify** `src/components/dashboard/Sidebar.tsx` -- Add nav item
5. **Modify** `src/pages/Dashboard.tsx` -- Wire up tab
