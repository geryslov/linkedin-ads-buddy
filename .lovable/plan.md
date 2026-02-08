

# Fix Build Error and Verify Company Influence Names

## Problem

The edge function has a build error that prevents deployment, which blocks all reports (including Company Influence) from running the latest code.

**Build Error:** At line 6596 in the edge function, `primaryMetric` is included in the `fatigueAnalysis.push()` call, but it's not defined in the type declaration at lines 6443-6462.

## Solution

### Step 1: Fix the build error

**File:** `supabase/functions/linkedin-api/index.ts`

Add `primaryMetric` to the `fatigueAnalysis` array type definition (lines 6443-6462):

```typescript
const fatigueAnalysis: Array<{
  creativeId: string;
  creativeName: string;
  campaignId?: string;
  objectiveType?: string;
  primaryMetric?: string;  // <-- ADD THIS LINE
  status: 'healthy' | 'warning' | 'fatigued';
  signals: string[];
  metrics: {
    totalImpressions: number;
    totalSpend: number;
    totalLeads: number;
    avgCtr: number;
    avgCpl: number;
    ctrTrend: number;
    cplTrend: number;
    impressionTrend: number;
  };
  recommendation: string;
  dailyData: Array<{ date: string; ctr: number; cpl: number; impressions: number }>;
}> = [];
```

This is a one-line addition that matches the `primaryMetric` field already being set in the code (line 6514) and pushed (line 6596).

### Step 2: Deploy and verify

After fixing the type, deploy the edge function. The Company Influence report already has a complete 3-step name resolution pipeline:

1. **Cache lookup** -- loads names from `linkedin_company_cache` (which has 700+ entries based on recent data)
2. **Batch API lookup** -- calls `/v2/organizationsLookup` for any missing IDs
3. **Fallback** -- shows "Company {ID}" with a pencil icon for manual naming

The name resolution code is already correct in the edge function. The real blocker is the build error preventing deployment.

## Files to Modify

1. `supabase/functions/linkedin-api/index.ts`
   - Line 6447: Add `primaryMetric?: string;` to the `fatigueAnalysis` type definition

## Expected Result

- Build error resolved
- Edge function deploys successfully
- Company Influence report loads with company names resolved from cache and API
- Creative Fatigue objective filtering continues to work with the `primaryMetric` field

