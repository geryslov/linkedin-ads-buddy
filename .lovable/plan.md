

# Enhanced Company Influence: Robust Name Resolution with Debugging

## Overview
This plan implements comprehensive improvements to the organization name resolution in the Company Influence report, including detailed logging, URN normalization, proper headers, and a frontend-visible debug flag when lookups fail.

---

## Changes Summary

| Component | Change |
|-----------|--------|
| Edge Function | Add detailed logging for organizationsLookup status/response body |
| Edge Function | Log first 5 raw `pivotValue` URNs from analytics |
| Edge Function | Create `normalizeCompanyUrn()` helper supporting multiple formats |
| Edge Function | Add LinkedIn API headers to org lookups |
| Edge Function | Return `namesResolutionFailed` flag on 403 errors |
| Frontend | Display "Names restricted" when resolution fails |

---

## Technical Implementation

### File: `supabase/functions/linkedin-api/index.ts`

#### Change 1: Add `normalizeCompanyUrn()` Helper (around line 469)

Create a helper function that extracts the numeric ID from any URN format and normalizes it:

```typescript
// Normalize company URN to extract the numeric ID
// Supports: urn:li:organization:123, urn:li:company:123, urn:li:memberCompany:123
function normalizeCompanyUrn(urn: string): { id: string | null; originalUrn: string } {
  if (!urn) return { id: null, originalUrn: urn };
  
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) {
    return { id: match[2], originalUrn: urn };
  }
  
  // Fallback: try to extract any numeric ID at the end
  const numericMatch = urn.match(/:(\d+)$/);
  if (numericMatch) {
    return { id: numericMatch[1], originalUrn: urn };
  }
  
  return { id: null, originalUrn: urn };
}
```

#### Change 2: Log First 5 Raw pivotValue URNs (around line 6844)

```typescript
// Log the first 5 raw pivotValue formats to diagnose URN type
console.log(`[get_company_influence] First 5 raw pivotValues: ${companyUrns.slice(0, 5).join(', ')}`);
```

#### Change 3: Use `normalizeCompanyUrn()` for ID Extraction (around line 6848-6857)

Replace the current regex with the normalized helper:

```typescript
// Extract organization IDs using normalize helper (supports all URN formats)
const orgIdToUrn = new Map<string, string>();
companyUrns.forEach(urn => {
  const { id, originalUrn } = normalizeCompanyUrn(urn);
  if (id) {
    orgIdToUrn.set(id, originalUrn);
  }
});

const orgIds = Array.from(orgIdToUrn.keys());
console.log(`[get_company_influence] Extracted ${orgIds.length} valid org IDs from ${companyUrns.length} URNs`);
```

#### Change 4: Add Proper Headers and Detailed Logging (around line 6870-6898)

Update the organizationsLookup call with:
- Standard LinkedIn API headers
- Log response status code and body snippet
- Track resolution failure state

```typescript
// Track if name resolution failed due to permissions
let namesResolutionFailed = false;
let namesResolutionError: string | null = null;

// Use V2 organizationsLookup endpoint with proper headers
if (orgIds.length > 0) {
  const batchSize = 50;
  for (let i = 0; i < orgIds.length; i += batchSize) {
    const batch = orgIds.slice(i, i + batchSize);
    const idsParam = batch.map((id, idx) => `ids[${idx}]=${id}`).join('&');
    
    try {
      const orgLookupUrl = `https://api.linkedin.com/v2/organizationsLookup?${idsParam}&projection=(results*(id,localizedName,vanityName))`;
      console.log(`[get_company_influence] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orgIds.length / batchSize)} - fetching org names...`);
      
      const orgResponse = await fetch(orgLookupUrl, {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202511',
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      
      // Log status code for every batch
      console.log(`[get_company_influence] Batch ${Math.floor(i / batchSize) + 1} response status: ${orgResponse.status}`);
      
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const results = orgData.results || {};
        
        // Log response structure
        const resultKeys = Object.keys(results);
        console.log(`[get_company_influence] Batch returned ${resultKeys.length} results, sample keys: ${resultKeys.slice(0, 3).join(', ')}`);
        
        Object.entries(results).forEach(([id, org]: [string, any]) => {
          const originalUrn = orgIdToUrn.get(id);
          const name = org?.localizedName || org?.vanityName;
          
          if (name) {
            // Store with original URN and all possible formats
            if (originalUrn) companyNames.set(originalUrn, name);
            companyNames.set(`urn:li:organization:${id}`, name);
            companyNames.set(`urn:li:company:${id}`, name);
            companyNames.set(`urn:li:memberCompany:${id}`, name);
            companyNames.set(id, name); // Also store by raw ID
          }
        });
        
        console.log(`[get_company_influence] Total names resolved so far: ${companyNames.size}`);
      } else {
        // Log the error response body
        const errText = await orgResponse.text();
        console.log(`[get_company_influence] Batch lookup FAILED: status=${orgResponse.status}, body=${errText.slice(0, 300)}`);
        
        // Track 403 permission errors
        if (orgResponse.status === 403) {
          namesResolutionFailed = true;
          namesResolutionError = `403 Forbidden: ${errText.slice(0, 100)}`;
        }
        
        // Fallback: individual lookups (with limited attempts)
        if (orgResponse.status !== 403 && i === 0) {
          console.log(`[get_company_influence] Attempting individual lookups for first batch...`);
          for (const id of batch.slice(0, 5)) {
            try {
              const singleUrl = `https://api.linkedin.com/v2/organizations/${id}?projection=(id,localizedName,vanityName)`;
              const singleResponse = await fetch(singleUrl, {
                headers: { 
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202511',
                }
              });
              
              console.log(`[get_company_influence] Individual lookup ${id}: status=${singleResponse.status}`);
              
              if (singleResponse.ok) {
                const singleData = await singleResponse.json();
                const name = singleData.localizedName || singleData.vanityName;
                if (name) {
                  companyNames.set(`urn:li:organization:${id}`, name);
                  companyNames.set(`urn:li:company:${id}`, name);
                }
              }
            } catch (err) {
              console.log(`[get_company_influence] Individual lookup ${id} error:`, err);
            }
          }
        }
      }
    } catch (e) {
      console.error(`[get_company_influence] Batch org lookup exception:`, e);
    }
  }
}

console.log(`[get_company_influence] FINAL: Resolved ${companyNames.size} company names. Resolution failed: ${namesResolutionFailed}`);
```

#### Change 5: Return Debug Flag in Response (around line 7095-7110)

Add the debug flags to the response metadata:

```typescript
return new Response(JSON.stringify({
  period: { start: startDate, end: endDate },
  summary,
  companies: companies.slice(0, 500),
  objectiveBreakdown: Array.from(objectiveStats.entries()).map(([objective, stats]) => ({
    objective,
    ...stats,
  })),
  metadata: {
    accountId,
    impressionThreshold,
    totalCampaignsAnalyzed: campaignMeta.size,
    namesResolutionFailed,
    namesResolutionError,
    namesResolvedCount: companyNames.size,
  }
}), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

---

### File: `src/hooks/useCompanyInfluence.ts`

Add metadata fields to the interface:

```typescript
export interface CompanyInfluenceData {
  // ... existing fields ...
  metadata: {
    accountId: string;
    impressionThreshold: number;
    totalCampaignsAnalyzed: number;
    namesResolutionFailed?: boolean;
    namesResolutionError?: string;
    namesResolvedCount?: number;
  };
}
```

---

### File: `src/components/dashboard/CompanyInfluenceReport.tsx`

Add a warning banner when names resolution fails:

```typescript
{data?.metadata?.namesResolutionFailed && (
  <Alert variant="warning" className="mb-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Company Names Restricted</AlertTitle>
    <AlertDescription>
      Unable to resolve company names due to API permissions. 
      Showing company IDs instead.
    </AlertDescription>
  </Alert>
)}
```

---

## Diagnostic Output

After deployment, the edge function logs will show:

```text
[get_company_influence] First 5 raw pivotValues: urn:li:company:12345, urn:li:organization:67890, ...
[get_company_influence] Extracted 199 valid org IDs from 200 URNs
[get_company_influence] Batch 1/4 - fetching org names...
[get_company_influence] Batch 1 response status: 200  // or 403
[get_company_influence] Batch returned 50 results, sample keys: 12345, 67890, ...
[get_company_influence] Total names resolved so far: 150
...
[get_company_influence] FINAL: Resolved 199 company names. Resolution failed: false
```

This will tell us:
- **Status 200 + empty results** = URN format mismatch or URL issue
- **Status 403** = Permission/tier/scope issue
- **Sample pivotValues** = Exact URN format LinkedIn returns

---

## Testing After Implementation

1. Navigate to Company Influence tab and refresh
2. Check edge function logs for the diagnostic output
3. If 403, frontend shows "Names Restricted" warning
4. If 200 with names, verify company names display correctly

