

# Fix: Build Error Blocking Edge Function Deployment

## Root Cause
The TypeScript error `TS18046: 'err' is of type 'unknown'` at line 7218 prevents the edge function from compiling and deploying. This means all the image URN resolution code added previously has never actually run.

## Fix
One line change in `supabase/functions/linkedin-api/index.ts`:

**Line 7218** — change:
```typescript
excludeResults.push({ campaignId, success: false, message: err.message || 'Unknown error' });
```
to:
```typescript
excludeResults.push({ campaignId, success: false, message: (err as Error).message || 'Unknown error' });
```

## After Fix
Once this deploys successfully, the batch image URN resolution code will become active. The user should then open the **Creatives tab**, and the logs should show entries like "Batch image URN resolution" and "with images:" confirming the fix is live.

## Files to Update
- `supabase/functions/linkedin-api/index.ts` — line 7218 only

