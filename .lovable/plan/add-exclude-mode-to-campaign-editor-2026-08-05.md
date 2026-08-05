# Add "Exclude" mode to Campaign Editor

Today the Campaign Editor can only Append or Replace job titles / skills in a campaign's **include** targeting. This adds a third mode that writes the selected titles and skills into the campaign's **exclude** targeting instead.

## What changes for the user

- The Append / Replace toggle gains a third option: **Exclude**.
- Picking Exclude and hitting update pushes the selected titles/skills into the campaign's exclusion list (people matching them stop being targeted), leaving all include targeting untouched.
- Exclusions merge with any exclusions already on the campaign — duplicates are removed, nothing existing is wiped.
- Confirmation text, result toast, and the results table wording reflect "excluded" instead of "added/replaced".

## Technical details

**Backend — `supabase/functions/linkedin-api/index.ts`, `update_campaign_targeting`**

- Accept `mode: 'exclude'` alongside `append` / `replace`.
- In the targeting-building step (Step 5), add an exclude branch:
  - Keep `include` exactly as fetched from the campaign.
  - Read existing `existingTargeting.exclude.or` (LinkedIn represents exclusions as a single `or` map of facet → URN array).
  - Merge `titleUrns` into `urn:li:adTargetingFacet:titles` and `skillUrns` into `urn:li:adTargetingFacet:skills` under that map, de-duplicating each facet array.
  - Emit `{ include: existingTargeting.include, exclude: { or: mergedMap } }`.
- Same PATCH call, error handling, and permission gating as the existing modes — no other logic touched.
- Update the final summary message to say "excluded" for this mode.
- Redeploy the function after the edit.

**Frontend — `src/components/dashboard/CampaignTargetingEditor.tsx`**

- Widen `updateMode` state to `'append' | 'replace' | 'exclude'` and add the third toggle button (MinusCircle icon) in the mode row.
- Pass the mode through in the existing request body (no shape change).
- Update the success toast and any append/replace wording to handle the third case.

No schema or new-table work; no change to how titles/skills are searched or selected.
