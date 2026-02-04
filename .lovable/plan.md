
# Fix Company Name Cache: RLS Authentication and Timeline Integration

## Problem Summary

The `linkedin_company_cache` table remains empty because:

1. **`update_company_name` uses wrong Supabase client** - Line 7607 uses `supabaseClient` which is initialized with the service role key but **without** the user's JWT Authorization header. Since RLS policies require `auth.uid() IS NOT NULL` for INSERT/UPDATE, all writes are silently blocked.

2. **Cache upserts in `get_company_engagement_timeline` have the same issue** - Lines 7467-7469 also use the global `supabaseClient`, so even when LinkedIn API lookups succeed, the names cannot be cached.

3. **Warning logic could be refined** - Currently sets `namesResolutionFailed = true` even when cache has names.

## Solution

### Change 1: Fix `update_company_name` to use authenticated client

**File:** `supabase/functions/linkedin-api/index.ts`  
**Location:** Lines 7593-7632

Create a request-scoped authenticated Supabase client using the Authorization header from the request, then use it for the upsert operation.

```text
Before (line 7607):
const { data, error } = await supabaseClient

After:
// Create request-scoped authenticated client
const authHeader = req.headers.get('Authorization') || '';
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data, error } = await supabaseAuth
```

### Change 2: Fix cache upserts in `get_company_engagement_timeline`

**File:** `supabase/functions/linkedin-api/index.ts`  
**Location:** Around lines 7457-7479

The automatic cache writes when LinkedIn API lookups succeed also need to use an authenticated client.

```text
Before (line 7467):
const { error: upsertError } = await supabaseClient

After:
// Create authenticated client for cache writes
const authHeader = req.headers.get('Authorization') || '';
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);

const { error: upsertError } = await supabaseAuth
```

### Change 3: Refine warning logic

**File:** `supabase/functions/linkedin-api/index.ts`  
**Location:** Lines 7481-7487

Update the condition to only show the warning when truly needed:
- If cache returned names, don't show warning even if some API lookups failed
- Only show warning when `companyNames.size === 0` AND lookups were blocked

```text
Current logic (lines 7481-7487):
if (successCount === 0 && failCount > 0 && namesResolutionFailed) {
  namesResolutionError = 'All organization lookups returned 403 Forbidden';
} else if (successCount > 0) {
  namesResolutionFailed = false;
}

Updated logic:
// Only mark as failed if we have NO names at all (from cache or API)
const totalNamesResolved = companyNames.size;
if (totalNamesResolved === 0 && failCount > 0) {
  namesResolutionFailed = true;
  namesResolutionError = 'All organization lookups returned 403 Forbidden and no cached names available';
} else if (totalNamesResolved > 0) {
  namesResolutionFailed = false;
}
```

## Technical Details

### Why the current code fails

The global `supabaseClient` at line 17 is:
```typescript
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
```

While this uses the service role key (which bypasses RLS), it doesn't include the Authorization header from the incoming request. When RLS policies check `auth.uid()`, it returns `NULL` because no user context is established.

The correct pattern (already used in `update_campaign_targeting` at lines 5657-5664 and `sync_ad_accounts`) is:
```typescript
const authHeader = req.headers.get('Authorization') || '';
const supabaseAuth = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
);
```

This passes the user's JWT, allowing `auth.uid()` to resolve correctly for RLS.

### Files to modify

1. `supabase/functions/linkedin-api/index.ts`
   - Update `update_company_name` handler (lines 7593-7632)
   - Update cache upsert in `get_company_engagement_timeline` (lines 7456-7479)
   - Refine warning logic (lines 7481-7487)

## Testing Steps

1. Navigate to the Company Engagement Timeline tab
2. Wait for data to load - check edge function logs for:
   - `[get_company_engagement_timeline] Loaded X cached company names`
   - `[get_company_engagement_timeline] Caching X newly resolved names...`
3. If companies show as "Company 12345":
   - Click the pencil icon
   - Enter the real company name
   - Click checkmark to save
4. Verify the save succeeded:
   - Check edge function logs for `[update_company_name] Saved name for...`
   - Query `linkedin_company_cache` table
5. Refresh page - the manually saved name should persist
