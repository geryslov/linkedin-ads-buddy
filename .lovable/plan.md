## Goal
Make the sum of objective-breakdown impressions match the company-level total in the Influence Matcher (and the Company Demographic table) by closing the two leaks in the breakdown query.

## Changes (single file: `supabase/functions/linkedin-api/index.ts`, `get_objective_breakdowns` case, ~lines 2659–2862)

### 1. Paginate the campaign-activity probe
Currently calls `pivot=CAMPAIGN` with `count=10000` and no pagination — accounts with more campaign-rows in the date range silently lose the tail.

Replace with a paged loop that follows `paging.total` / page size 10000 and accumulates into `campaignsActiveInRange` until exhausted (cap at 100k for safety, mirroring `get_company_demographic`).

### 2. Stop dropping campaigns with no `objectiveType`
Today line 2729 does `if (objective === 'UNKNOWN') continue;`. Instead:
- Fall back to `campaign.type` (e.g. `SPONSORED_UPDATES`, `TEXT_AD`) when `objectiveType` is missing.
- If both are missing, bucket under the literal label `UNCLASSIFIED` so its impressions still show up.

### 3. Backfill campaigns that delivered but aren't in `/adCampaignsV2`
The campaign listing can omit deleted campaigns whose impressions still appear in analytics. After the activity probe, any campaign ID present in `campaignsActiveInRange` but missing from `campaignNameMap` gets:
- name = `Campaign {id}` (or whatever the activity probe carried)
- objective = `UNCLASSIFIED`

This guarantees every active campaign is queried in at least one objective bucket.

### 4. Frontend label cleanup (tiny)
In `src/hooks/useCompanyInfluenceMatcher.ts` the objective is passed straight through; no changes needed — `UNCLASSIFIED` will render as-is. If you want a friendlier label ("Other / Unclassified"), I'll add a `fmtObj` mapping in `CompanyInfluenceMatcher.tsx` only.

## Verification
1. Deploy `linkedin-api` edge function.
2. In the UI, run Company Demographic for a known account, expand a company, and confirm: `sum(objective.impressions) === company.impressions`.
3. Check edge logs for `[get_objective_breakdowns] Activity probe paged: N campaigns active` and `Found K objectives` — K should now include `UNCLASSIFIED` if applicable.

## Out of scope
No changes to UI styling, no changes to the company-level query, no schema changes.
