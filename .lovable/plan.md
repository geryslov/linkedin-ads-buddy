

# Fix: Creative Images Not Showing

## Root Cause

The logs reveal two critical failures preventing images from appearing:

1. **Step 3 batch fetch returns HTTP 500** -- The V2 batch endpoint (`adCreativesV2?ids=List(...)`) consistently fails. The individual V2 fallback (`adCreativesV2/{id}`) runs sequentially for 224 creatives, which is slow and may time out. When it works, it does extract the `reference` URN needed for image resolution.

2. **Step 4 ignores image data** -- Step 4 already makes individual calls to the versioned REST API (`/rest/adAccounts/{id}/creatives/{urn}`) to get creative names. This API returns `content` with a `reference` URN pointing to the UGC post or share that contains the actual image. But the code only extracts `name` and throws away the `content.reference` -- missing the key piece needed for image resolution.

The flow is: Creative metadata has a `reference` URN (e.g., `urn:li:ugcPost:12345`) --> Step 5 fetches that UGC post/share --> extracts the image URL from its media array. But if `reference` is empty (because Step 3 failed and Step 4 doesn't extract it), Step 5 has nothing to resolve.

## Solution

Merge Steps 3 and 4 into a single pass using the versioned REST API (which already works reliably in Step 4). Extract both the `name` AND the `content.reference` in one call, eliminating the broken V2 batch endpoint entirely. This means:

- Remove Step 3's V2 batch fetch (which returns 500)
- In Step 4's versioned API call, also extract the reference URN from `content.reference`
- Step 5 then has references to resolve images from

## Changes

### File: `supabase/functions/linkedin-api/index.ts`

**Step 3 (lines ~2830-2930)**: Replace the V2 batch fetch with a simple placeholder setup. Since Step 4 will handle all metadata, Step 3 only needs to create initial entries with campaign info from analytics.

**Step 4 (lines ~2932-2964)**: Update the versioned API fetch to also extract:
- `content.reference` -- the URN pointing to the UGC post/share containing the image
- Store it on the `creativeInfoMap` entry so Step 5 can resolve images

Specifically, change lines 2952-2958 from:
```text
if (creativeResp.ok) {
  const creativeDetail = await creativeResp.json();
  const existing = creativeInfoMap.get(creativeId);
  if (existing && creativeDetail.name) {
    existing.name = creativeDetail.name;
    creativeInfoMap.set(creativeId, existing);
  }
}
```
To also extract reference:
```text
if (creativeResp.ok) {
  const creativeDetail = await creativeResp.json();
  const existing = creativeInfoMap.get(creativeId);
  if (existing) {
    if (creativeDetail.name) existing.name = creativeDetail.name;
    // Extract reference URN for image resolution
    const ref = creativeDetail.content?.reference;
    if (ref) existing.reference = ref;
    creativeInfoMap.set(creativeId, existing);
  }
}
```

**Step 3 simplification**: Remove the V2 batch GET entirely (lines 2836-2907) and replace with simple placeholder creation from `creativeIdsWithData`, using campaign info already available from analytics. The individual V2 fallback is also removed since the versioned API in Step 4 handles everything.

### Deployment
- Redeploy the `linkedin-api` backend function

## Technical Details

The versioned REST API response for a creative looks like:
```text
{
  "name": "My Ad Creative",
  "content": {
    "reference": "urn:li:ugcPost:7654321"
  },
  ...
}
```

Step 5 then fetches `urn:li:ugcPost:7654321` and extracts the image from `specificContent.com.linkedin.ugc.ShareContent.media[0].thumbnails[0].url`. This path already works -- the only issue was that `reference` was never being populated because Step 3 failed and Step 4 didn't extract it.
