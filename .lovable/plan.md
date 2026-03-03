

## Problem

The `get_objective_breakdowns` edge function action is hitting the **CPU timeout** (~5.5s, limit is ~2s). It fetches all campaigns, groups them by objective, then fires parallel analytics queries for every objective in a single invocation. For large accounts (like MineOS with hundreds of campaigns and many objectives), this exceeds the CPU limit and returns a 500.

## Solution: Paginate by Objective

Apply the same incremental loading pattern used for company demographics -- process **one objective per edge function call** instead of all at once.

### Edge Function Changes (`supabase/functions/linkedin-api/index.ts`)

1. **Add a new action `get_objective_breakdown_single`** that:
   - Accepts `accountId`, `dateRange`, `objective`, `campaignIds[]`, and `campaignNames` as params
   - Runs a single `adAnalyticsV2` query pivoted by `MEMBER_COMPANY` filtered to those campaigns
   - Returns `{ objective, breakdowns: { [entityUrn]: metrics } }`
   - This keeps each call lightweight and well within CPU limits

2. **Modify `get_objective_breakdowns`** to only do Step 1 + Step 2 (fetch campaigns, group by objective) and return the objective-to-campaign mapping:
   - Returns `{ objectives: { [objective]: { campaignIds, campaignNames } } }` 
   - No analytics queries -- just campaign metadata

### Frontend Changes (`src/hooks/useCompanyDemographic.ts`)

3. **Refactor `fetchObjectiveBreakdowns`** to:
   - First call `get_objective_breakdowns` to get the objective→campaign mapping
   - Then loop through each objective, calling `get_objective_breakdown_single` one at a time
   - Merge results into `objectiveBreakdownCache` progressively (so UI updates as each objective completes)
   - Track progress with a counter for the loading indicator

### UI Changes (`src/components/dashboard/CompanyInfluenceMatcher.tsx`)

4. **Add progress indicator** showing "Loading objective 2 of 7..." during the sequential fetching, similar to the company demographic progress bar.

### Technical Details

- Each `get_objective_breakdown_single` call handles one objective's analytics query (~500ms-2s depending on campaign count)
- The campaign metadata fetch in the refactored `get_objective_breakdowns` is fast (just listing campaigns, no analytics)
- Progressive cache merging means users see partial data as it loads
- The existing `objectiveBreakdownsFetched` flag prevents re-fetching

