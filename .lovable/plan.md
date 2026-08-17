# Fix "titles length 109 cannot exceed maximum 100" in Audience Templates

## What is happening

Applying the audience `gradeA-t1-t2` to `financial_wv_feed_titles-all_ABM-AI4-company-list_na` failed with LinkedIn's hard cap: a single targeting facet may hold at most **100 values**, and this audience carries **109 job titles**.

The sync runs in two calls: first `replace` for the include layer, then `exclude` for the exclusion layer. The logs show the replace call reported success and the exclude call came back with the 400 — LinkedIn validates the whole `targetingCriteria`, so the oversized include titles list surfaces on the second call.

The backend already has a capacity guard (`MAX_FACET_VALUES = 100`, plus a `preflight_campaign_targeting` action and a `fillToLimit` option), and the Campaign Editor uses it. **Audience Templates does not** — `syncAudience` calls `update_campaign_targeting` directly with no preflight and no trimming, so an oversized template goes straight to LinkedIn. The logs also report "0 over facet limit" for a request that LinkedIn then rejected at 109, so whether the deployed function actually enforces the guard on this path needs to be confirmed before anything else.

## Plan

1. **Verify the guard on the live function.** Redeploy `linkedin-api` and re-run the same audience through `preflight_campaign_targeting`. Confirm it reports titles = 109 / over limit. If it reports "fits", the merge math for the generic `facets` map is the bug and gets fixed there.
2. **Add a preflight to Audience Templates.** Before syncing, call `preflight_campaign_targeting` for both the include set and the exclude set across the selected campaigns, and show a warning banner: which campaigns exceed which field, current count, and room left.
3. **Block or trim, user's choice.** Same controls as the Campaign Editor: an over-limit sync is blocked by default, with a "Fill to the limit" option that trims the additions to what fits and reports how many values were dropped.
4. **Surface capacity in the editor itself.** In the Audience breakdown panel, show a per-field count with an over-limit marker (for example `Job titles (current) — 109 / 100`) so the audience can be trimmed at edit time instead of at apply time.
5. **Report results per campaign.** Replace the single red toast with the per-campaign result rows already used by the Campaign Editor, so a partial failure is readable.

## Technical notes

- `src/hooks/useAudienceTemplates.ts` — add a `preflightAudience()` that posts `action: 'preflight_campaign_targeting'` with the same `facets` map `syncAudience` builds; thread a `fillToLimit` flag through `syncAudience`.
- `src/components/dashboard/AudienceTemplates.tsx` — debounced preflight on campaign-selection change, warning banner, "Fill to the limit" checkbox, per-campaign results list, per-facet count badges in the breakdown.
- `supabase/functions/linkedin-api/index.ts` — only touched if step 1 shows the generic-facet merge miscounts; redeploy either way.

## Note on this audience

Even after the guard lands, `gradeA-t1-t2` cannot be applied as-is: 109 titles will not fit in one campaign. It has to be trimmed to 100, or split into two audiences applied to different campaigns.
