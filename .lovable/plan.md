

# Fix Company Engagement Timeline Data Fetching

## Problem Summary

The Company Engagement Timeline shows no data and no company names because:

1. **useEffect has a missing dependency** - The `fetchTimeline` function isn't in the dependency array, so when `accessToken` becomes available, the effect doesn't re-run and no API call is made
2. **Different API approach** - The Timeline uses individual org lookups (which can fail with 403) while Demographic uses batch lookups (which often succeed)

## Solution

### Change 1: Fix the useEffect dependency array

**File:** `src/components/dashboard/CompanyEngagementTimeline.tsx`  
**Location:** Lines 270-274

Add `fetchTimeline` to the dependency array:

```tsx
// Before:
useEffect(() => {
  if (selectedAccount && accessToken) {
    fetchTimeline(selectedAccount);
  }
}, [selectedAccount, accessToken, dateRange.start, dateRange.end]);

// After:
useEffect(() => {
  if (selectedAccount && accessToken) {
    fetchTimeline(selectedAccount);
  }
}, [selectedAccount, accessToken, dateRange.start, dateRange.end, fetchTimeline]);
```

This ensures that when `accessToken` becomes available and `fetchTimeline` is recreated with the new token, the effect will re-run and actually call the API.

## Why This Matters

The `fetchTimeline` function is created with `useCallback` and depends on `accessToken`:

```tsx
const fetchTimeline = useCallback(async (accountId: string) => {
  if (!accessToken || !accountId) return;
  // ... fetch logic using accessToken
}, [accessToken, dateRange]);
```

1. On initial render: `accessToken = null`, `fetchTimeline` exists but won't fetch
2. When auth completes: `accessToken` gets a value, `fetchTimeline` is recreated
3. **Without `fetchTimeline` in deps**: The effect doesn't re-run → no fetch happens
4. **With `fetchTimeline` in deps**: The effect re-runs → fetch succeeds

## Comparison: Why Demographic Works

| Aspect | Demographic | Timeline |
|--------|-------------|----------|
| **useEffect deps** | Likely has correct dependencies | Missing `fetchTimeline` |
| **API endpoint** | `/v2/organizationsLookup` (batch) | `/v2/organizations/{id}` (individual) |
| **403 handling** | Batch often succeeds | Individual calls may get 403 |
| **Uses cache** | No | Yes (loads from `linkedin_company_cache`) |

## Files to Modify

1. `src/components/dashboard/CompanyEngagementTimeline.tsx`
   - Line 274: Add `fetchTimeline` to the `useEffect` dependency array

## Testing Steps

1. Navigate to the Company Engagement Timeline tab
2. Verify the loading skeleton appears
3. Check edge function logs for `[get_company_engagement_timeline]` entries
4. Confirm company data appears in the table and charts
5. Verify company names display (either from cache or as "Company 12345" with edit icons)

