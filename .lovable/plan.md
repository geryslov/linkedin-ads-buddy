

# Pull Actual Creative Images from LinkedIn API

## Overview
Add creative image thumbnails to the Creative Report tables. The LinkedIn API provides image URLs through the UGC post/share content, which we can extract alongside the text we already resolve.

## How It Works (LinkedIn API Flow)

1. We already fetch UGC posts and shares to resolve creative names (text)
2. Those same API responses contain media references with image URNs
3. For UGC posts: `specificContent['com.linkedin.ugc.ShareContent'].media[0].thumbnails[0].url` or the media's `originalUrl`
4. For shares: `content.contentEntities[0].thumbnails[0].resolvedUrl`
5. As a fallback for newer image URNs (`urn:li:image:...`), we can call LinkedIn's **Images API** (`GET https://api.linkedin.com/rest/images/{imageUrn}`) which returns a `downloadUrl`

## Changes

### 1. Edge Function: Extract image URLs during name resolution
**File**: `supabase/functions/linkedin-api/index.ts`

In the existing reference resolution logic (where we fetch UGC posts/shares to get creative names), also extract the first image thumbnail URL from the response:
- From UGC posts: look at `specificContent['com.linkedin.ugc.ShareContent'].media[0]` for thumbnail URLs or `originalUrl`
- From shares: look at `content.contentEntities[0].thumbnails[0].resolvedUrl`
- Store the image URL in the creative metadata alongside the name

This applies to the `get_creative_report` and `get_creative_names_report` actions. Return a new `imageUrl` field in each element.

### 2. Frontend: Add image column to Creative Report tables
**Files**:
- `src/hooks/useCreativeReporting.ts` — Add `imageUrl` to `CreativeData` interface
- `src/hooks/useCreativeNamesReport.ts` — Add `imageUrl` to `CreativeNameData` interface
- `src/components/dashboard/CreativeReportingTable.tsx` — Add a small thumbnail column before the Creative Name column
- `src/components/dashboard/CreativeNamesReportTable.tsx` — Add thumbnail to the grouped creative rows
- `src/components/dashboard/CreativeFatigueDetector.tsx` — Add thumbnail next to creative name

### 3. Image display approach
- Show a small 40x40px thumbnail in the table
- Click to open a larger preview (using a Dialog/popover)
- Show a placeholder icon when no image is available (e.g., for Text Ads)
- Use `object-cover` and rounded corners for clean display

## Technical Details

### UGC Post image extraction (already-fetched data)
```text
post.specificContent['com.linkedin.ugc.ShareContent']
  .media[0]
    .thumbnails[0].url          -- thumbnail
    .originalUrl                -- or full image
```

### Share image extraction
```text
share.content.contentEntities[0]
  .thumbnails[0].resolvedUrl    -- thumbnail URL
```

### Images API fallback (for urn:li:image URNs)
```text
GET https://api.linkedin.com/rest/images/{imageUrn}
Headers: LinkedIn-Version: 202511, Authorization: Bearer ...
Response: { downloadUrl: "https://media.licdn-ei.com/..." }
```

### Performance considerations
- No extra API calls needed for most creatives (images come from the same UGC/share responses we already fetch)
- Images API fallback only used when media contains `urn:li:image:` references without embedded thumbnails
- CDN URLs are returned directly to the browser (no proxying needed)
