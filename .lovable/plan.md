

# Fix Company Influence Report: Company Names and Campaign Breakdown

## Problem Summary
The Company Influence report is displaying company IDs (e.g., "Company 717281") instead of actual company names, and the campaign breakdown shows "Campaign-level breakdown not available."

## Root Cause Analysis

After examining the code, I found **two key issues**:

### Issue 1: Organization Batch Lookup Failing
The `get_company_influence` handler uses the REST API format `/rest/organizations?ids=List(...)` for batch lookups, which appears to be failing silently. When the batch lookup fails, it falls back to individual lookups, but the fallback mechanism may also be encountering issues.

**Current approach** (Company Influence - Line 6856):
```typescript
const idsParam = batch.map(id => `(id:${id})`).join(',');
const batchUrl = `https://api.linkedin.com/rest/organizations?ids=List(${idsParam})`;
```

**Working approach** (Company Demographic - Line 2174):
```typescript
const idsParam = batch.map((id, idx) => `ids[${idx}]=${id}`).join('&');
const orgResponse = await fetch(
  `https://api.linkedin.com/v2/organizationsLookup?${idsParam}&projection=(...)`
);
```

The Company Demographic handler uses the **V2 organizationsLookup endpoint** with array-style parameters, while Company Influence uses the **REST API** with List syntax which appears to fail.

### Issue 2: Campaign Breakdown Empty
The campaign breakdown requires per-campaign analytics with MEMBER_COMPANY pivot. This is currently implemented but may be timing out or failing for large accounts due to rate limits.

## Solution

Align the Company Influence handler with the proven Company Demographic implementation:

### Step 1: Use V2 organizationsLookup Endpoint
Replace the REST API batch lookup with the V2 `organizationsLookup` endpoint used in Company Demographic, which has proven reliable.

### Step 2: Add extractNameFromUrn Fallback
Improve the fallback to use the `extractNameFromUrn` helper consistently (matching Company Demographic pattern).

### Step 3: Improve Campaign Breakdown Fetching
Add better error handling and logging for the campaign-level breakdown queries.

---

## Technical Implementation

### File: `supabase/functions/linkedin-api/index.ts`

**Location: Lines 6845-6910 (Organization name resolution)**

Replace the current REST API batch lookup with the V2 organizationsLookup pattern:

```typescript
// Step 3: Resolve company names via Organization Lookup API (batch)
const companyUrns = Array.from(companyData.keys()).slice(0, 200);
const companyNames = new Map<string, string>();

console.log(`[get_company_influence] Resolving names for ${companyUrns.length} companies...`);

// Extract org IDs and build URN-to-ID mapping
const orgIdToUrn = new Map<string, string>();
for (const urn of companyUrns) {
  const id = urn.split(':').pop();
  if (id) {
    orgIdToUrn.set(id, urn);
  }
}

const orgIds = Array.from(orgIdToUrn.keys());

// Use V2 organizationsLookup endpoint (proven reliable in Company Demographic)
if (orgIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < orgIds.length; i += batchSize) {
    const batch = orgIds.slice(i, i + batchSize);
    const idsParam = batch.map((id, idx) => `ids[${idx}]=${id}`).join('&');
    
    try {
      const orgResponse = await fetch(
        `https://api.linkedin.com/v2/organizationsLookup?${idsParam}&projection=(results*(id,localizedName,vanityName))`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const results = orgData.results || {};
        
        Object.entries(results).forEach(([id, org]: [string, any]) => {
          const urn = orgIdToUrn.get(id);
          if (!urn) return;
          
          const name = org?.localizedName || org?.vanityName;
          if (name) {
            companyNames.set(urn, name);
          }
        });
        console.log(`[get_company_influence] Batch ${Math.floor(i / batchSize) + 1} resolved ${Object.keys(results).length} names`);
      } else {
        console.log(`[get_company_influence] Batch lookup failed: ${orgResponse.status}, trying individual lookups`);
        
        // Fallback to individual lookups
        for (const id of batch) {
          try {
            const singleUrl = `https://api.linkedin.com/v2/organizations/${id}?projection=(id,localizedName,vanityName)`;
            const singleResponse = await fetch(singleUrl, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (singleResponse.ok) {
              const orgData = await singleResponse.json();
              const name = orgData.localizedName || orgData.vanityName;
              if (name) {
                companyNames.set(`urn:li:organization:${id}`, name);
              }
            }
          } catch (err) {
            // Silent fail for individual lookups
          }
        }
      }
    } catch (e) {
      console.error(`[get_company_influence] Batch org lookup error:`, e);
    }
  }
}

console.log(`[get_company_influence] Resolved ${companyNames.size} company names out of ${companyUrns.length}`);
```

**Location: Line 7027 (Company name assignment)**

Use `extractNameFromUrn` helper for better fallback:

```typescript
// Get company name - use resolved name or extract from URN
const companyName = companyNames.get(companyUrn) || extractNameFromUrn(companyUrn);
```

---

## Summary of Changes

| Component | Current Issue | Fix |
|-----------|--------------|-----|
| Organization lookup | Uses REST API `/rest/organizations?ids=List(...)` which fails | Use V2 `organizationsLookup` endpoint with array parameters |
| Fallback name | Falls back to `Company {id}` format | Use `extractNameFromUrn` helper |
| Batch size | 20 per batch | Increase to 50 (matching Company Demographic) |
| Campaign breakdown | May timeout silently | Add better error handling and logging |

## Testing After Implementation
1. Navigate to the Company Influence tab
2. Select an account and click Refresh
3. Verify company names display properly (not IDs)
4. Click on a company row to expand campaign breakdown
5. Verify campaign breakdown shows data (if campaigns exist)

