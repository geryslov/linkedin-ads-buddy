
# Fix Creative Fatigue Ad Name Display and Build Errors

## Problems Found

### Problem 1: Build Errors (Blocking)
The edge function has compilation errors referencing an undefined variable `failCount`:
- Line 7036: `if (successCount === 0 && failCount > 0 && namesResolutionFailed)`
- Line 7502: `if (totalNamesResolved === 0 && failCount > 0)`

This variable was likely removed during a previous code edit but the references remain.

### Problem 2: Creative Fatigue Missing Ad Names
The Creative Fatigue detector uses a **simpler name resolution** compared to the Creative Report:

| Feature | Creative Report | Creative Fatigue |
|---------|----------------|------------------|
| Legacy adCreativesV2 API | Yes | No |
| REST API individual lookup | Yes | Yes (only this) |
| Share/UGC post text fallback | Yes | No |
| Batch processing | 200 creatives | All creatives |
| Fallback name | `Creative ${id}` | `Creative ${id}` |

The Creative Fatigue only tries individual REST API lookups which may return empty names for many creatives.

## Solution

### Fix 1: Remove undefined `failCount` references

**File:** `supabase/functions/linkedin-api/index.ts`

**Location 1 - Line 7036 (`get_company_influence`):**
```typescript
// Before:
if (successCount === 0 && failCount > 0 && namesResolutionFailed) {

// After:
if (successCount === 0 && namesResolutionFailed) {
```

**Location 2 - Line 7502 (`get_company_engagement_timeline`):**
```typescript
// Before:
if (totalNamesResolved === 0 && failCount > 0) {

// After:
if (totalNamesResolved === 0 && namesResolutionFailed) {
```

### Fix 2: Enhance Creative Fatigue name resolution

Update the `get_creative_fatigue` action to use the same robust name resolution as `get_creative_report`:

1. **First**: Try batch fetch from `adCreativesV2` API to get all creatives with basic metadata
2. **Second**: For creatives without names, use REST API individual lookup  
3. **Third**: For creatives with `reference` field (share/ugcPost URN), fetch share content text
4. **Final fallback**: Use `Creative ${id}` only when all methods fail

**Location:** Lines 6271-6315 in `get_creative_fatigue`

Replace the simple name resolution with:

```typescript
// Step 2A: Fetch creative metadata via adCreativesV2 (fast batch fetch)
const creativeMetadata = new Map<string, { name: string; reference: string }>();
const creativeUrns = Array.from(creativeDaily.keys());

try {
  const url = `https://api.linkedin.com/v2/adCreativesV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=500`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (response.ok) {
    const data = await response.json();
    for (const creative of (data.elements || [])) {
      const creativeId = creative.id?.toString() || '';
      const name = creative.name || creative.creativeDscName || '';
      const reference = creative.reference || '';
      creativeMetadata.set(`urn:li:sponsoredCreative:${creativeId}`, { name, reference });
    }
  }
} catch (err) {
  console.error('[get_creative_fatigue] adCreativesV2 fetch error:', err);
}

// Step 2B: For creatives without names, try REST API individual lookup
const creativeNames = new Map<string, string>();
let namesResolved = 0;

for (const urn of creativeUrns) {
  const meta = creativeMetadata.get(urn);
  if (meta?.name) {
    creativeNames.set(urn, meta.name);
    namesResolved++;
  }
}

// Step 2C: Individual REST API lookup for remaining creatives
const needsLookup = creativeUrns.filter(urn => !creativeNames.has(urn));
// ... (individual lookup code as exists)

// Step 2D: Share/UGC text fallback for remaining
const needsShareFallback = creativeUrns.filter(urn => {
  if (creativeNames.has(urn)) return false;
  const meta = creativeMetadata.get(urn);
  return meta?.reference && (meta.reference.includes('share') || meta.reference.includes('ugcPost'));
});

for (const urn of needsShareFallback.slice(0, 50)) {
  const meta = creativeMetadata.get(urn);
  if (!meta?.reference) continue;
  
  // Fetch share/ugcPost content
  const isUgc = meta.reference.includes('ugcPost');
  const endpoint = isUgc
    ? `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(meta.reference)}`
    : `https://api.linkedin.com/v2/shares/${encodeURIComponent(meta.reference)}`;
  
  try {
    const resp = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      let text = '';
      if (isUgc) {
        text = data.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '';
      } else {
        text = data.text?.text || '';
      }
      if (text) {
        // Truncate to first 60 chars
        creativeNames.set(urn, text.slice(0, 60) + (text.length > 60 ? '...' : ''));
        namesResolved++;
      }
    }
  } catch (e) {
    // Continue on error
  }
}
```

## Files to Modify

1. `supabase/functions/linkedin-api/index.ts`
   - Line 7036: Fix `failCount` reference in `get_company_influence`
   - Line 7502: Fix `failCount` reference in `get_company_engagement_timeline`
   - Lines 6271-6315: Enhance name resolution in `get_creative_fatigue`

## Expected Result

After these changes:
- Build errors will be resolved
- Creative Fatigue will display actual ad names instead of generic "Creative 12345"
- Name resolution will use the same robust approach as the Creative Report
