# Fix Audience Template sync at the 100-title limit

## Confirmed cause

The audience shows **10 included + 90 excluded current titles**, but LinkedIn’s limit is evaluated per targeting bucket/facet—not as the visible template total.

For exclusions, the current sync uses **merge/add** behavior. The selected campaign already has 58 excluded titles; 43 overlap with the template and 47 are new, so the outgoing exclusion becomes **58 + 47 = 105**. That is why reducing the template itself to 100 values still fails.

There is also a state mismatch: **Apply** uses the last saved `activeTemplate`, not the chips currently visible in the editor. Removing values and applying before clicking **Save changes** can therefore send the older audience.

## Plan

1. **Add an audience-specific exclusion replacement mode.** Extend `update_campaign_targeting` with a mode that replaces the selected exclusion facets instead of merging them. Keep the Campaign Editor’s existing `exclude` behavior unchanged, because that tool is intentionally additive.
2. **Sync the template as the source of truth.** Audience Templates will replace each exclusion facet represented in the template, so 90 excluded titles produces 90 excluded titles on the campaign—not the campaign’s previous 58 plus the template’s new values.
3. **Apply the visible draft.** Build the sync payload from the editor’s current include/exclude lists. If those differ from the saved template, save them before applying so the campaign, assignment record, and template stay consistent.
4. **Preflight the final replacement payload.** Run the same backend capacity calculation before the write and show the actual outgoing count per campaign/facet. Block only when the replacement itself exceeds 100.
5. **Make counts unambiguous.** Show separate capacity labels such as `Include 10 / 100` and `Exclude 90 / 100`; do not imply that include + exclude is one shared 100-value allowance.
6. **Verify and deploy.** Test a campaign with existing title exclusions and this 10-include/90-exclude template, confirm the final campaign has exactly those 90 exclusions, then deploy `linkedin-api` and update `FEATURES.md` / `HISTORY.md`.

## Technical details

- `supabase/functions/linkedin-api/index.ts`: add a distinct exclusion-replace mode and reuse it for preflight; deduplicate URNs before counting and writing.
- `src/hooks/useAudienceTemplates.ts`: send replacement mode for template exclusions, expose preflight, and accept the current draft payload.
- `src/components/dashboard/AudienceTemplates.tsx`: save/apply the visible draft atomically and display separate per-layer capacity.
- Preserve all existing Campaign Editor add/replace/exclude semantics.