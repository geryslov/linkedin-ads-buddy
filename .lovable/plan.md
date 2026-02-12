

# Fix: Creative Thumbnails Not Showing

## Root Cause

The image extraction only happens for creatives that **failed** name resolution. Here's the problem flow:

1. Step 5 (line 1220): Only collects share URNs for creatives where `!data.name` (no name resolved)
2. Step 6 (line 1229): Only fetches share content for those unresolved URNs
3. Step 7 (line 1265): Tries to get `imageUrl` from `shareContentData`, but it's empty for most creatives because their share content was never fetched

Since most creatives DO get names from the versioned API, their share references are skipped, and `imageUrl` is always empty.

## Fix

### 1. Edge Function: Fetch share content for ALL creatives with references (not just unresolved ones)

**File**: `supabase/functions/linkedin-api/index.ts`

Change Step 5 to collect ALL share URNs (not just unresolved), and fetch share content for all of them to extract image URLs:

- Line 1218-1225: Collect share URNs from ALL creatives that have a `reference`, regardless of whether they already have a name
- This means `fetchShareContent` will be called with all share references, giving us image URLs for every creative

The same fix needs to be applied to the `get_creative_names_report` action as well, where a similar pattern exists.

### 2. Redeploy the edge function

After the code change, redeploy `linkedin-api` to make it live.

## Technical Details

**Current code (broken)**:
```text
// Only collects URNs for creatives WITHOUT names
versionedCreativeData.forEach((data, creativeId) => {
  if (!data.name && data.reference) {
    unresolvedShareUrns.push(data.reference);
  }
});
```

**Fixed code**:
```text
// Collect ALL share URNs for image extraction
const allShareUrns: string[] = [];
versionedCreativeData.forEach((data, creativeId) => {
  if (data.reference) {
    allShareUrns.push(data.reference);
  }
  // Also track unresolved ones for name fallback
  if (!data.name && data.reference) {
    unresolvedShareUrns.push(data.reference);
  }
});

// Fetch share content for ALL references (for images)
shareContentData = await fetchShareContent(allShareUrns, accessToken);
```

Note: The `fetchShareContent` function already has a limit of 50 share URNs (line 1081), so this won't cause excessive API calls. We may want to increase this limit slightly since we're now fetching for all creatives.

