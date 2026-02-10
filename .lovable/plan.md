

# Only Count Leads from Lead Generation Campaigns

## Problem
Currently, the "Leads" metric in the Campaign Report counts `oneClickLeads + externalWebsiteConversions` for **all** campaigns regardless of their objective type. This inflates the leads count with conversions from non-lead-gen campaigns (e.g., Engagement, Brand Awareness) that aren't actual lead generation leads.

## Solution
Filter lead counting so that only campaigns with `objectiveType === 'LEAD_GENERATION'` contribute to the leads total. Non-lead-gen campaigns will show `0` for leads, LGF Form Opens, LGF Completion Rate, and Cost Per Lead.

## Changes

### 1. Edge Function: `supabase/functions/linkedin-api/index.ts`

In the `get_campaign_report` action, modify the leads calculation in three places:

- **DAILY granularity path (~line 3326)**: Look up the campaign's `objectiveType` from `campaignInfoMap`. Only set `leads` if objective is `LEAD_GENERATION`, otherwise set to `0`.

- **ALL granularity aggregation (~line 3371)**: Same check — only accumulate `oneClickLeads`, `externalWebsiteConversions`, and `oneClickLeadFormOpens` when the campaign's objective is `LEAD_GENERATION`.

- **Final report building (~line 3388-3389)**: Cost Per Lead and LGF Completion Rate are already derived from leads, so they'll naturally become `0` for non-lead-gen campaigns.

### 2. No Frontend Changes Needed
The frontend already displays whatever the API returns. Since non-lead-gen campaigns will now return `leads: 0`, the totals and per-campaign rows will automatically reflect accurate lead counts.

## Technical Details

The key check at each aggregation point will be:
```text
const isLeadGen = (info.objectiveType === 'LEAD_GENERATION');
const leads = isLeadGen ? (row.oneClickLeads || 0) + (row.externalWebsiteConversions || 0) : 0;
const lgfFormOpens = isLeadGen ? (row.oneClickLeadFormOpens || 0) : 0;
```

This ensures LGF metrics (Form Opens, Completion Rate, Cost Per Lead) are also zeroed out for non-lead-gen campaigns, keeping all lead-related metrics consistent.
