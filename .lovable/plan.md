# Fix: empty ad account picklist

## What we know

The account dropdown is fed only by a live LinkedIn call (`get_ad_accounts`) in `src/hooks/useLinkedInAds.ts`. If that call fails or returns nothing, the list renders empty with only a generic "Failed to fetch ad accounts" toast — there is no fallback to the accounts already cached in the database, and no visible reason (expired LinkedIn token, rate limit 429, missing scope, edge function error).

I have not yet confirmed which of those is happening in your session, so step 1 is diagnosis.

## Plan

1. **Diagnose first**
   - Check the LinkedIn token state for your user and the recent `linkedin-api` edge function logs for `get_ad_accounts` (401 = expired token, 429 = rate limit, 403 = scope).
   - Check whether cached accounts exist in `linkedin_ad_accounts` / `user_linked_accounts` for your user.

2. **Never show an empty list when we have data**
   - On mount, load cached accounts from the database and populate the picklist immediately.
   - Then refresh from LinkedIn in the background and replace the list only on success. A failed refresh keeps the cached list instead of blanking it.

3. **Surface the real reason**
   - Replace the generic toast with the actual failure: expired/invalid token → "Reconnect LinkedIn" action; 429 → "LinkedIn rate limit, retry in a moment"; anything else → the API message.
   - When LinkedIn genuinely returns zero accounts, show the existing "No ad accounts" pill with the access hint (current behaviour) rather than a silent blank.

4. **Make refresh honest**
   - The refresh button should bypass the 60-second fetch throttle so a manual click always re-queries LinkedIn.

## Technical notes

- `src/hooks/useLinkedInAds.ts`: add a `loadCachedAccounts()` that reads `user_linked_accounts` (account_id, account_name, user_role, can_write, is_default) and seeds `adAccounts` before `fetchAdAccounts()` runs; keep prior state on error; add a `force` flag to `fetchAdAccounts` used by the refresh path.
- Error mapping reads the edge function's status/message from the `linkedin-api` response body.
- No schema changes; no edge function changes unless diagnosis shows a backend fault.
