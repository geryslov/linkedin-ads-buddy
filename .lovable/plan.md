

# Add Engagement Breakdown (Likes, Comments, Reactions) to Company Demographic Report

## Overview
Replace the single "Engagements" number with a breakdown showing Likes, Comments, Reactions, and Shares. The total Engagements column stays, but clicking/hovering reveals the granular breakdown via a popover.

## Changes

### 1. Backend: `supabase/functions/linkedin-api/index.ts`

**`get_company_demographic` action (Step 1 analytics fetch):**
- Add `likes`, `comments`, `reactions`, `shares` to the `fields` parameter alongside `totalEngagements`
- Update the `companyMap` type to track these four fields
- Aggregate them during pagination just like the other metrics

**`get_company_demographic` objective breakdown (Step 4):**
- Add the same four fields to objective-level analytics queries
- Aggregate per-objective breakdown

**`get_company_campaign_breakdown` action:**
- Add the four fields to campaign-level queries
- Include in the response

### 2. Data Hook: `src/hooks/useCompanyDemographic.ts`

- Add `likes`, `comments`, `reactions`, `shares` to `CompanyDemographicItem`, `ObjectiveBreakdownItem`, and `CampaignBreakdownItem` interfaces
- Map the new fields in the fetch response handler

### 3. UI: `src/components/dashboard/CompanyDemographicTable.tsx`

- Replace the plain Engagements number with a clickable Popover
- Popover shows a small 4-row breakdown: Likes, Comments, Reactions, Shares
- The column header remains "Engagements" (total)
- Apply the same popover pattern at the objective and campaign breakdown levels
- Footer totals include aggregated likes/comments/reactions/shares in a popover too

## Technical Details

### LinkedIn API Fields
The `adAnalyticsV2` endpoint supports these granular engagement fields at the `MEMBER_COMPANY` pivot:
- `likes` -- total likes on the ad
- `comments` -- total comments
- `reactions` -- total reactions (superset of likes on newer content)
- `shares` -- total shares/reposts

These are added to the existing `fields` query parameter, comma-separated.

### Popover UI Pattern
```text
+--------------------+
| Engagements: 1,234 |  <-- clickable
+--------------------+
     |
     v
+--------------------+
| Likes:      450    |
| Comments:   120    |
| Reactions:  580    |
| Shares:      84    |
+--------------------+
```

Each level (company, objective, campaign) gets this popover on the Engagements cell.

