# What the "length 117 cannot exceed maximum 100" error means

It is not a bulk-update bug. LinkedIn caps **each targeting facet at 100 values per campaign**. When you exclude 43 job titles, each campaign already carries its own existing title list — for campaigns that already had e.g. 80 excluded titles, the merged list becomes 117/124/141 and LinkedIn rejects that single campaign with a 400.

That is why you saw "3/15 campaigns updated": the 3 campaigns with room succeeded, the rest were already close to the cap. Doing them one at a time would fail the same way — it just looks like a bulk problem because you see all the failures at once.

Confirmed in the code: `update_campaign_targeting` dedupes URNs and merges into the campaign's existing facet, but never checks the resulting facet size before sending it to LinkedIn.

## Fix

### 1. Pre-flight capacity check (backend)
Before PATCHing each campaign, compute the merged facet size. If it would exceed 100, skip the LinkedIn call and return a clear result for that campaign:
`"Would exceed LinkedIn's 100-value limit for titles (currently 82, adding 43 → 117). Room for 18 more."`
Applies to every facet involved (titles, skills, employers, industries), in both include and exclude.

### 2. Better result reporting (frontend)
Replace the wall-of-text toast with a per-campaign summary panel after Apply:
- Updated (green) / Skipped — over limit (amber) / Failed (red)
- For each over-limit campaign: current count, how many would be added, remaining room
- A "Copy report" button

### 3. Pre-check before you click Apply
When campaigns are selected and the targeting set is non-empty, run a lightweight capacity check and show an inline warning above the Apply button:
`"7 of 15 campaigns will exceed the 100-title limit."` with an expandable list — so you know before the write, not after.

### 4. Optional partial-fill mode
A checkbox: "Fill to the limit instead of skipping". Over-limit campaigns get as many of the selected titles as fit (in selection order), and the response says exactly which ones were dropped.

## Technical notes
- `supabase/functions/linkedin-api/index.ts`, `case 'update_campaign_targeting'`: add a `MAX_FACET_VALUES = 100` guard in the per-campaign loop, after the merge and before the `partial_update` POST; push a `FACET_LIMIT_EXCEEDED` result with counts instead of calling LinkedIn.
- Add a read-only companion action (`preflight_campaign_targeting`) that runs the same merge math over the selected campaigns and returns counts only — used by step 3.
- `src/components/dashboard/CampaignTargetingEditor.tsx`: results panel + inline pre-check warning; keep the existing toast for hard failures only.
- Edge function must be redeployed after the change.
