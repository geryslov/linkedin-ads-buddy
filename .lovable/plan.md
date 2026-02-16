

# Fix: Creative Gallery Images Not Showing (get_creative_report)

## Problem
The Creative Gallery shows "212 active creatives, 0 with images" because the `get_creative_report` action has the same root cause we previously fixed in `get_creative_names_report`: the `content.reference` URN is never extracted from the versioned REST API response.

## Root Cause
In `fetchCreativesVersioned` (lines 1045-1079 of `supabase/functions/linkedin-api/index.ts`), the individual versioned API lookup extracts `name` and attempts to find images via `content.media.downloadUrl` -- but for Sponsored Content ads, the image lives in a referenced UGC post/share, accessible only through `content.reference`. This field is never read, so the `reference` property stays empty, and Steps 5-6 (which resolve images from UGC posts/shares) have nothing to work with.

## Solution
Add `content.reference` extraction to the versioned API lookup inside `fetchCreativesVersioned`, matching what we already did for `get_creative_names_report`.

## Changes

### File: `supabase/functions/linkedin-api/index.ts`

In the `fetchCreativesVersioned` function, after the existing image extraction logic (around line 1072), add extraction of `content.reference`:

```text
// Current code (lines 1047-1079):
if (existing) {
  if (creativeDetail.name) {
    existing.name = creativeDetail.name;
    namesResolved++;
  }
  // Extract image URL from creative content
  let imageUrl = '';
  const content = creativeDetail.content;
  if (content) {
    imageUrl = content.media?.downloadUrl || '';
    // ... other paths ...
  }
  existing.imageUrl = imageUrl;
  creativeData.set(creativeId, existing);
}

// Fixed code - add reference extraction:
if (existing) {
  if (creativeDetail.name) {
    existing.name = creativeDetail.name;
    namesResolved++;
  }
  // Extract reference URN for image resolution via share/UGC content
  const ref = creativeDetail.content?.reference;
  if (ref) existing.reference = ref;

  // Extract image URL from creative content (direct paths)
  let imageUrl = '';
  const content = creativeDetail.content;
  if (content) {
    imageUrl = content.media?.downloadUrl || '';
    // ... other paths unchanged ...
  }
  existing.imageUrl = imageUrl;
  creativeData.set(creativeId, existing);
}
```

This ensures the `reference` field is populated before Steps 5-6, which already correctly fetch UGC posts/shares and extract image URLs from them.

### Deployment
Redeploy the `linkedin-api` backend function.
