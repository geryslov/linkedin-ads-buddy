
# Fix Company Influence Report: Company Names Not Displaying

## Problem
The Company Influence report displays company IDs (like "717281") instead of actual company names, even though the edge function logs show that 199/200 company names were successfully resolved from LinkedIn's API.

## Root Cause

After examining the code, there is a **key mismatch** between how companies are stored and how names are looked up:

1. **Analytics data storage** (line 6799-6820): Companies are stored in `companyData` using `el.pivotValue` as the key, which comes directly from LinkedIn's analytics response

2. **Name resolution** (line 6848-6854): The code extracts org IDs using a regex that expects `urn:li:organization:12345` format, then stores resolved names keyed by the same URN format

3. **Name lookup** (line 7039): When building the final response, it looks up names using `companyNames.get(companyUrn)` where `companyUrn` is the original `pivotValue`

**The Issue**: LinkedIn's MEMBER_COMPANY analytics may return `pivotValue` in a format like `urn:li:company:717281` instead of `urn:li:organization:717281`. The regex on line 6850 only matches `urn:li:organization:`, so it fails to extract IDs for companies with different URN prefixes.

This explains why:
- The logs show "Extracted 199 valid org IDs" (some match)
- But companies still show as numeric IDs (the lookup fails because the key format differs)

## Solution

Update the URN parsing to handle both `urn:li:organization:` and `urn:li:company:` formats, and ensure names are stored with the original URN as the key for reliable lookups.

---

## Technical Implementation

### File: `supabase/functions/linkedin-api/index.ts`

**Change 1: Update URN regex to handle both formats (around line 6846-6858)**

Current:
```typescript
companyUrns.forEach(urn => {
  const match = urn.match(/^urn:li:organization:(\d+)$/);
  if (match) {
    orgIdToUrn.set(match[1], urn);
  }
});
```

Updated:
```typescript
companyUrns.forEach(urn => {
  // Handle both urn:li:organization: and urn:li:company: formats
  const match = urn.match(/^urn:li:(organization|company):(\d+)$/);
  if (match) {
    orgIdToUrn.set(match[2], urn); // match[2] is the ID
  }
});
```

**Change 2: Store names with original URN key (around line 6879-6892)**

Ensure we always store the name using the exact original URN from `companyData`, not a reconstructed one:

```typescript
Object.entries(results).forEach(([id, org]: [string, any]) => {
  // Get the original URN that was used in companyData
  const originalUrn = orgIdToUrn.get(id);
  
  if (org?.localizedName && originalUrn) {
    companyNames.set(originalUrn, org.localizedName);
  } else if (org?.vanityName && originalUrn) {
    companyNames.set(originalUrn, org.vanityName);
  }
});
```

**Change 3: Add logging to debug URN formats (optional but helpful)**

Add a log to show what URN formats are being received:

```typescript
console.log(`[get_company_influence] Sample URNs: ${companyUrns.slice(0, 3).join(', ')}`);
```

---

## Summary of Changes

| Location | Current Issue | Fix |
|----------|---------------|-----|
| Line 6850 | Only matches `urn:li:organization:` | Also match `urn:li:company:` |
| Line 6880-6891 | Stores names with reconstructed URN | Store with original URN from orgIdToUrn map |
| Line 7039 | No change needed | Will work once keys match |

## Testing After Implementation

1. Navigate to the Company Influence tab
2. Select an account and click Refresh  
3. Verify company names display properly instead of numeric IDs
4. Check the edge function logs for the "Sample URNs" output to confirm URN formats
