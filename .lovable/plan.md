
# Add Company Logos to Company Demographic Report

## Overview

Display company logos next to company names in the Company Demographic table. Logos are fetched from the LinkedIn API during the existing organization lookup step and cached in the database for future use.

## How It Works

The LinkedIn `organizationsLookup` API already returns a `logoV2` field (no admin access required). The flow to get a usable image URL is:

1. Add `logoV2` to the existing projection in `organizationsLookup`
2. Extract the `logoV2.original` URN (e.g., `urn:li:digitalmediaAsset:C560BAQGBzZXn5Schaw`)
3. Convert `digitalmediaAsset` to `image` in the URN
4. Call LinkedIn's Images API (`/rest/images/{imageURN}?fields=downloadUrl`) to get the actual CDN URL
5. Return the `downloadUrl` alongside company data
6. Cache it in `linkedin_company_cache` so we don't re-fetch on every load

## Changes

### 1. Database: Add `logo_url` column to `linkedin_company_cache`

Add a nullable `logo_url TEXT` column to cache resolved logo URLs.

### 2. Edge Function: Fetch logos during org lookup

**File:** `supabase/functions/linkedin-api/index.ts`

In the `get_company_demographic` action's Step 2 (organization name resolution):

- Update the projection to include `logoV2`: `projection=(results*(id,localizedName,localizedWebsite,vanityName,logoV2))`
- After getting results, collect all `logoV2.original` URNs
- Convert each URN from `digitalmediaAsset` to `image`
- Batch-call the LinkedIn Images API (`/rest/images/{imageURN}?fields=downloadUrl`) to resolve download URLs
- Store the logo URL in a `companyLogos` map alongside the existing `companyNames` and `companyWebsites` maps
- Include `logoUrl` in the response for each company element
- Also cache the `logo_url` when upserting to `linkedin_company_cache`

### 3. Hook: Add `logoUrl` to data model

**File:** `src/hooks/useCompanyDemographic.ts`

- Add `logoUrl: string | null` to `CompanyDemographicItem` interface
- Map it from the API response

### 4. Frontend: Display logos in table

**File:** `src/components/dashboard/CompanyDemographicTable.tsx`

- Import the `Avatar`, `AvatarImage`, `AvatarFallback` components
- In the Company column cell, add a small avatar (24x24) before the company name
- Use `AvatarFallback` with `Building2` icon when no logo is available
- This replaces the current `Building2` icon that shows when there's no breakdown

## Technical Details

### Images API Call

The Images API is a simple GET per image URN. To avoid rate limits, logos will be resolved in parallel batches of 20. Each call is lightweight and fast.

```
GET https://api.linkedin.com/rest/images/urn:li:image:C560BAQGBzZXn5Schaw?fields=downloadUrl
Headers: Authorization: Bearer {token}, LinkedIn-Version: 202511
```

### Caching Strategy

- First check `linkedin_company_cache.logo_url` for cached logos
- Only call the Images API for orgs without a cached logo
- Upsert `logo_url` back to cache after resolution
- This means logos are fetched once and reused across all subsequent loads

### Performance Impact

Minimal -- the logo resolution runs in parallel with the existing org lookup. The Images API calls are fast (no analytics data). Cached logos skip the API entirely on subsequent loads.

## Files to Modify

1. **Database migration** -- Add `logo_url` column to `linkedin_company_cache`
2. `supabase/functions/linkedin-api/index.ts` -- Add `logoV2` to projection, resolve via Images API, cache results
3. `src/hooks/useCompanyDemographic.ts` -- Add `logoUrl` field to interface and mapping
4. `src/components/dashboard/CompanyDemographicTable.tsx` -- Display logo avatars in company column
