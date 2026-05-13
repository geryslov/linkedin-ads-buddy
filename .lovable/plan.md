## Goal
Show the **creative names** that delivered for each matched company in the Influence Matcher (and Company Demographic table), the same way campaign names are shown today, and include them in the CSV export.

## Important constraint (worth surfacing up front)
LinkedIn's analytics API does **not** allow a dual pivot like `MEMBER_COMPANY × CREATIVE` — that combination is what causes the 500 errors we already had to design around. So we **cannot** get true "impressions per creative per company" without one query per (company, creative) pair, which would explode into thousands of calls.

What we *can* do cleanly, mirroring the existing campaign-name behaviour:

- Pull the list of creatives that **delivered (impressions > 0)** within the matched campaigns over the selected date range.
- Resolve their names via the Creatives API (already done elsewhere in the codebase).
- Attach those creative names to each objective bucket (so when a company expands, you see the campaigns *and* the creatives that ran inside those campaigns during that period).

This gives "creatives that contributed to this company's results" — not "this creative drove X impressions on this company". If you actually need per-creative per-company numbers, that's a separate, much heavier feature.

## Changes

### 1. Edge function — `supabase/functions/linkedin-api/index.ts`, `get_objective_breakdowns` case (~lines 2659–2894)

After the activity probe (line ~2729) and before the per-objective MEMBER_COMPANY queries:

a. **Probe creatives active in range** — single paginated `pivot=CREATIVE` analytics call filtered to `accounts[0]` for the date range, fields `pivotValue,impressions`. Collect `{creativeId → campaignId}` map (we'll need a follow-up `/rest/creatives` lookup for the campaign reference) and the set of creative IDs with impressions > 0.

b. **Resolve creative names** — batch GET `/rest/creatives` (using the existing helper pattern around lines 1431/1604/3087) for the active creative IDs; pull `name` (or fall back to ad type / `Creative {id}`) and the parent `campaign` URN.

c. **Group creatives by objective** — using the campaign→objective map already built at line 2732, produce `objectiveCreativeInfo: { [objective]: { creativeIds: string[], creativeNames: Record<string,string> } }`.

d. **Attach to result** — extend the `finalResult` mapping (line ~2864) so each objective bucket also carries `creativeIds` and `creativeNames` (same shape as `campaignIds` / `campaignNames`).

### 2. Frontend types — `src/hooks/useCompanyDemographic.ts`

Add to `ObjectiveBreakdownItem` (line 23):

```ts
creativeIds?: string[];
creativeNames?: Record<string, string>;
```

No other changes in this file — values flow through the existing breakdown plumbing.

### 3. Influence matcher — `src/hooks/useCompanyInfluenceMatcher.ts`

a. Extend `MatchedObjective` with `creativeNames: string[]` and `creativeNamesMap: Record<string,string>`.
b. In `buildObjectives`, mirror the campaign-names logic to collect creative names per objective, plus an `allCreativeNames` set on the parent `MatchedCompany`.
c. In `getExportData`, add a new column `creativeNames` (semicolon-joined, deduped) right after `campaignNames`.

### 4. UI — `src/components/dashboard/CompanyInfluenceMatcher.tsx`

Wherever the per-objective campaign names are rendered today (the expanded objective row), render a second labeled list "Creatives" with the same chip/text styling. Keep it collapsed-friendly (truncate to first N + "+X more") if the existing campaign list does that.

### 5. Optional (nice-to-have)
Surface "Creatives" as a column or inline list on the matched-company row when the user hasn't expanded the objective breakdown — so the CSV and the on-screen view stay aligned.

## Out of scope
- True per-creative × per-company attribution (would require an explicit drill-down feature and many more API calls).
- Creative thumbnails / previews (we already have `CreativeThumbnail` if you want it later, but not part of this change).
- Any change to the company-level totals or the `UNCLASSIFIED` bucket logic — those stay as just-fixed.

## Verification
1. Deploy `linkedin-api`.
2. Run Company Demographic → Influence Matcher for a known account.
3. Expand a matched company → confirm each objective lists both campaign names *and* creative names.
4. Export CSV → confirm new `creativeNames` column populated.
5. Edge logs should show `[get_objective_breakdowns] Creative probe: N creatives active`.
