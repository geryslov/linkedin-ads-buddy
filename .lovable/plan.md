

## Current State

The **Audience Insights** tab currently shows a simple grid of DMP Segment cards (from `/v2/dmpSegments`), displaying only:
- Segment name
- Status (READY / other)
- Matched member count

That's it — no deeper insights at all.

## What the LinkedIn Marketing API Actually Offers for Audience Insights

Based on the endpoints already implemented in your edge function and the LinkedIn Marketing API capabilities, here's what's available:

### Already Built (just not surfaced in the Audiences tab)
1. **Demographic breakdown by audience pivot** — your `get_demographic_analytics` action already supports pivoting by Company, Job Title, Job Function, Industry, Seniority, and Country. This data (impressions, clicks, spend, leads, CTR, CPC, CPM per entity) is powerful audience insight but currently lives only in the separate "Analytics" tab.

2. **Audience Expansion suggestions** — your `useAudienceExpansion` hook fetches top-performing titles/functions and generates expansion recommendations. Also not surfaced in the Audiences tab.

3. **Company engagement timeline** — tracks company-level engagement over time (separate tab).

4. **Job Seniority Matrix** — cross-tabs seniority × function performance (separate tab area).

### Available via API but Not Yet Built
1. **DMP Segment details** — the `/v2/dmpSegments` response actually returns more fields than you're using: `type` (COMPANY, CONTACT, LOOKALIKE, etc.), `sourcePlatform`, `createdAt`, `lastModifiedAt`, `destinations`, and `accessPolicy`. These are free data you're already fetching but discarding.

2. **Audience Counts / Forecasting** — the `/v2/adTargetingFacets` and `/v2/reachEstimate` endpoints can estimate the size of a targeting criteria combination before you commit budget. This tells you "if I target these titles + industries + seniorities, how many people match?"

3. **Targeting Facet browsing** — `/v2/adTargetingFacets` lets you browse available targeting values (all industries, all seniorities, all company sizes, etc.) which helps users discover segments they haven't tried.

### NOT Available via API
- Individual member-level data (LinkedIn doesn't expose this)
- Audience overlap analysis between segments
- Lookalike audience creation (only available in Campaign Manager UI)

## Recommendation

Rather than building new API integrations, the highest-value improvement is **consolidating existing data into the Audiences tab** as a richer insights hub. No new API calls needed — just better presentation of data you already fetch.

### Proposed Enhancements (No New API Work)

1. **Enrich the DMP segment cards** — show segment type, source platform, creation date, and last modified date (data already in the API response, just not mapped)

2. **Add a "Demographic Performance" section** below the segment cards — embed the demographic pivot table (already built as `DemographicTable`) directly in the Audiences tab, so users can see who's engaging without switching tabs

3. **Add an "Expansion Suggestions" section** — embed the `AudienceExpansionSuggester` component (already built) so users see title/function expansion ideas in context

4. **Add a "Seniority × Function" matrix view** — embed the `JobSeniorityMatrix` (already built) for a quick cross-tab view

This turns the Audiences tab from a flat list of segments into a proper insights dashboard — all using components and hooks that already exist.

