

# Fix: Add Lead Sync Scope to OAuth Flow

## Root Cause

The OAuth scope string in the edge function (line 589) is:
```
r_liteprofile r_ads r_ads_reporting rw_ads w_member_social
```

It does **not** include `r_marketing_leadgen_automation`. Even though you added this scope to your LinkedIn Developer Portal app, the OAuth flow never requests it. So the access token lacks permission to call `/rest/leadForms`, all 4 name resolution strategies fail silently, and form names fall back to `Form {numericId}`.

## Plan

### 1. Add the missing scope to the OAuth URL (edge function)

**File:** `supabase/functions/linkedin-api/index.ts`, line 589

Change:
```typescript
const scope = 'r_liteprofile r_ads r_ads_reporting rw_ads w_member_social';
```
To:
```typescript
const scope = 'r_liteprofile r_ads r_ads_reporting rw_ads w_member_social r_marketing_leadgen_automation';
```

### 2. Re-authenticate

After deploy, you must **disconnect and reconnect** LinkedIn in the app so the new token includes the Lead Sync scope. The current token was issued without it.

## Expected Result

After reconnecting, the `/rest/leadForms?q=owner` endpoint will return form objects with real names instead of 403/401 errors, and the Form Name column will show descriptive names.

