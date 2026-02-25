
Goal: Fix why the user sees only placeholder/pseudo images in the **Creatives tab (gallery)** even after thumbnail UI work.

What I found in the codebase:
1. The user is checking the **Creatives tab (gallery)** (`Dashboard.tsx` activeTab `"creatives"`), which uses `CreativeGallery.tsx` + `useCreativeReporting.ts` + edge function action `get_creative_report`.
2. The recent thumbnail fixes were applied to **Creative Reports** and campaign/creative trend tables, not the gallery pipeline.
3. In `get_creative_report`, image extraction currently assumes direct fields like:
   - `content.media?.downloadUrl`
   - `content.landingPage?.landingPageMedia?.thumbnail`
   - `content.spotlight?.logo?.downloadUrl`
   - `content.followCompany?.logo?.downloadUrl`
4. There is **no implementation for resolving image URNs via `/rest/images?ids=List(...)`**, and no handling for `downloadUrlExpiresAt`.
5. Result: for creatives where media is an image URN/reference (common), `imageUrl` stays empty, so gallery falls back to placeholder icon for almost all rows.

User clarifications captured:
- Where checked: **Creatives tab (gallery)**
- Behavior: **Only placeholders**

Implementation plan:

Phase 1 — Fix backend image resolution in `get_creative_report` (primary root cause)
1. Add a reusable extractor to collect potential image identifiers from creative content:
   - Support both object and string forms (e.g., `content.media` may be object or URN string).
   - Capture:
     - direct URL candidates (`downloadUrl`, `thumbnail`, `resolvedUrl`)
     - image URN candidates (`urn:li:image:...`)
     - media IDs that can map to image URNs.
2. Add a batch resolver utility inside the edge function:
   - `resolveImageUrnsBatch(imageUrns: string[], token: string)` calling:
     - `GET https://api.linkedin.com/rest/images?ids=List(...)`
   - Include required headers:
     - `Authorization: Bearer ...`
     - `LinkedIn-Version: 202511`
     - `X-Restli-Protocol-Version: 2.0.0`
   - Parse each image record and map URN -> `{ downloadUrl, downloadUrlExpiresAt }`.
3. During creative metadata fetch:
   - First keep direct URLs when present.
   - If only URN/media id exists, defer and resolve via batch images API.
   - Apply resolved downloadUrl back to each creative’s `imageUrl`.
4. Keep existing share/UGC fallback, but make order explicit:
   1) direct creative URL
   2) resolved image URN URL (`/rest/images`)
   3) share/UGC thumbnail fallback
   4) placeholder
5. Add resolution stats logs in response metadata:
   - `directCreativeUrlCount`
   - `resolvedViaImagesApiCount`
   - `resolvedViaShareFallbackCount`
   - `missingImageCount`
   This makes debugging visible without guessing.

Phase 2 — Handle temporary URL expiration safely
1. Since `downloadUrl` is temporary, keep `downloadUrlExpiresAt` in temporary in-memory mapping during request.
2. On each report fetch, always re-resolve URN-based assets (already fresh each invocation), so stale URLs are naturally replaced.
3. (Optional hardening) if a URL is near expiry in the same request pipeline, refresh immediately from images endpoint before returning.

Phase 3 — Frontend robustness in gallery (small hardening, not primary fix)
1. Keep current `<img src={creative.imageUrl}>` behavior.
2. Add per-card debug fallback attributes (or hidden diagnostics in dev mode) to distinguish:
   - `no_image_url`
   - `img_load_error`
3. Do not block rendering for creatives without images; continue showing placeholder for dynamic/text/message formats.

Phase 4 — Extend consistency to other creative surfaces
1. Apply the same resolver helper to `get_creative_performance_report` so both gallery and trend reports behave consistently.
2. Ensure no regression in existing thumbnail columns.

Files to update:
1. `supabase/functions/linkedin-api/index.ts`
   - `case 'get_creative_report'`:
     - add URN extraction
     - add `/rest/images` batch resolution
     - apply precedence/fallback logic
     - add debug metadata counters
   - `case 'get_creative_performance_report'`:
     - reuse same image resolution helper for parity
2. `src/components/dashboard/CreativeGallery.tsx` (optional robustness-only diagnostics)
3. Potentially shared helper blocks inside same edge function file (no new file required).

Why this solves the issue:
- The current flow misses creatives whose media is an image URN rather than a direct URL object.
- The LinkedIn images endpoint is the intended path to transform URNs into download URLs.
- Re-fetching each report naturally handles temporary URL expiration windows.
- The user’s “only placeholders” symptom matches missing URN resolution in the gallery pipeline.

Verification checklist (end-to-end):
1. Open **Creatives** tab for selected account.
2. Confirm “with images” count increases from near-zero to realistic values.
3. Confirm image cards render actual ad creatives, not placeholders.
4. Change date range (7d/14d/30d/etc.) and refresh: images still render.
5. Validate mixed ad types:
   - Single image ads show thumbnails.
   - Video/dynamic/text ads may still show placeholders when no image asset exists (expected).
6. Open one thumbnail dialog and verify full-size image loads.
7. Cross-check **Creative Reports** table thumbnails still work after shared resolver update.

Technical details (for implementation):
```text
Data flow target in get_creative_report:
Creative detail content
  -> extract {directUrlCandidates, imageUrnCandidates}
  -> if directUrl found: use
  -> else if imageUrn exists: resolve with /rest/images batch
  -> else if reference exists: fallback to share/UGC thumbnail
  -> else: undefined (placeholder)

Headers for /rest/images:
- Authorization: Bearer <token>
- LinkedIn-Version: 202511
- X-Restli-Protocol-Version: 2.0.0
```

Risk notes:
1. Some ad formats legitimately have no image. Those should continue to display placeholders.
2. Large accounts may require chunking `ids=List(...)` requests (e.g., batches of 20–50 URNs) to avoid URL length limits.
3. If LinkedIn returns protected/invalid URLs for some assets, image load failures should remain isolated per creative, not break the grid.

No database schema/auth changes needed:
- This is backend function + frontend rendering logic only.
- No migration, no new tables, no RLS updates required.
