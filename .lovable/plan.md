

# Fix: Ad Type Filter Shows Only "Sponsored Content"

## Problem
The creative type detection in the backend function defaults everything to `SPONSORED_CONTENT` because it checks for content sub-fields (`content.textAd`, `content.spotlightAd`, etc.) that don't exist in the REST API v202511 response. The REST API returns `content` as a simple URN reference string, not a nested object with type-specific keys.

## Solution
Use the campaign's `type` field (which LinkedIn always returns on campaign objects as e.g. `TEXT_AD`, `VIDEO_AD`, `SPONSORED_UPDATES`) to determine the ad format. This is reliable because LinkedIn enforces that all creatives in a campaign must match the campaign's ad format.

## Changes

### 1. `supabase/functions/linkedin-api/index.ts` -- Step 1 (Campaign Fetch)
- Capture the campaign `type` field alongside `name` and `status` in a new map: `cpCampaignTypes`.
- The campaign `type` field returns values like: `TEXT_AD`, `SPONSORED_UPDATES`, `SPONSORED_INMAILS`, `DYNAMIC`, etc.

### 2. `supabase/functions/linkedin-api/index.ts` -- Step 3 (Creative Metadata)
- Replace the unreliable content-structure detection with campaign-type-based detection.
- Map campaign types to creative display types:
  - `TEXT_AD` -> `TEXT_AD`
  - `SPONSORED_UPDATES` -> check the `content` reference for video/carousel hints, otherwise `SPONSORED_CONTENT`
  - `SPONSORED_INMAILS` / `SPONSORED_MESSAGING` -> `MESSAGE_AD`
  - `DYNAMIC` -> inspect the creative's `content` for `spotlightAd`, `followerAd`, `jobsAd` (dynamic ads do have these subfields), or default to `SPOTLIGHT_AD`
- Add a `console.log` to output the detected type distribution for debugging.
- Also add logging of a sample creative's raw response structure so we can verify what fields are actually returned.

### 3. `src/components/dashboard/CreativeTypeBadge.tsx`
- Add `MESSAGE_AD` and `DOCUMENT_AD` entries to the type config for complete coverage.

## Technical Details

The campaign `type` field is fetched from the same `/rest/adAccounts/{id}/adCampaigns` endpoint already called in Step 1. We just need to read `c.type` from each campaign element and store it. Then in Step 3, instead of inspecting `content` sub-objects (which are empty in the REST API), we look up the campaign type via `cpCampaignTypes.get(campId)`.

### Type Mapping Logic
```text
Campaign type          -> Display type
TEXT_AD                -> TEXT_AD
SPONSORED_UPDATES      -> SPONSORED_CONTENT (default), VIDEO (if reference contains video), CAROUSEL (if multiple media)
SPONSORED_INMAILS      -> MESSAGE_AD
DYNAMIC                -> SPOTLIGHT_AD / FOLLOWER_AD / JOBS_AD (from content sub-fields)
```

For `SPONSORED_UPDATES` campaigns, we still inspect the `content.reference` URN to distinguish video vs single image vs carousel, but only as a secondary signal -- the primary type comes from the campaign.

