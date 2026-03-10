

# Fix Lead Form Name Resolution — Use Correct Lead Sync API Endpoints

## Problem

The current edge function calls **wrong endpoints** that don't exist in the Lead Sync API:
- Bulk: `/rest/leadGenForms?q=account&accounts=List(...)` — **wrong**
- Individual: `/rest/adAccounts/{id}/adForms/{urn}` — **wrong**
- Fallback: `/v2/adForms?q=account&account=...` — **deprecated/wrong**

The correct Lead Sync API endpoints per the documentation are:
- Bulk: `/rest/leadForms?q=owner&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A{accountId})&count=500`
- Individual: `/rest/leadForms/{formId}`

The API returns `name` as a plain string (e.g., `"name": "LeadGen form for Nimbus 2000"`), not a localized object.

## Plan

### 1. Fix the bulk endpoint (Step 3 in edge function)

**File:** `supabase/functions/linkedin-api/index.ts` (~line 5162)

Change:
```
/rest/leadGenForms?q=account&accounts=List(urn:li:sponsoredAccount:${accountId})&count=500
```
To:
```
/rest/leadForms?q=owner&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A${accountId})&count=500
```

### 2. Simplify name extraction (~lines 5198-5221)

The API returns `name` as a plain string. Simplify the extraction logic — remove the localized object handling since this API doesn't use it.

### 3. Fix the individual lookup endpoint (Step 3b, ~line 5264)

Change:
```
/rest/adAccounts/${accountId}/adForms/${formUrn}
```
To:
```
/rest/leadForms/${formId}
```
No URN encoding needed — just the numeric form ID.

### 4. Remove the v2/adForms fallback (~lines 5226-5246)

The `v2/adForms` endpoint is deprecated. With the correct `/rest/leadForms` endpoint, no fallback is needed.

## Technical Details

- The `/rest/leadForms` endpoint requires `r_ads` or `r_marketing_leadgen_automation` scope
- Requires `LinkedIn-Version` and `X-Restli-Protocol-Version: 2.0.0` headers (already present)
- Response `name` field is a plain string, `id` is a plain number

