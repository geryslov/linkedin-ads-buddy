
# Fix Edge Function Errors and Build Error

## Summary
There are two issues to fix:

1. **Edge Function 400 Errors**: The deployed edge function was outdated and missing the `get_budget_pacing`, `get_creative_fatigue`, and `get_audience_expansion` action handlers. I've already redeployed the edge function, and all three actions are now working correctly.

2. **TypeScript Build Error**: The `useBudgetPacing.ts` file has a type error at line 98. The `saveBudget` function is trying to upsert to the `account_budgets` table without including the required `user_id` field.

## What Was Already Fixed
- The edge function has been redeployed and all three feature endpoints are now returning 200 status codes

## What Needs To Be Fixed

### Build Error in useBudgetPacing.ts

**Problem**: The `account_budgets` table requires a `user_id` field, but the `saveBudget` function doesn't include it in the upsert operation.

**Error Message**:
```
Object literal may only specify known properties, and 'account_id' does not exist in type '...'
```

**Solution**: Modify the `saveBudget` function to:
1. Get the current authenticated user's ID from Supabase Auth
2. Include `user_id` in the upsert data

### Code Changes

**File**: `src/hooks/useBudgetPacing.ts`

Update the `saveBudget` function to get the user ID and include it in the upsert:

```typescript
const saveBudget = useCallback(async (accountId: string, amount: number, currency: string = 'USD') => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const { error: upsertError } = await supabase
      .from('account_budgets')
      .upsert({
        account_id: accountId,
        budget_amount: amount,
        currency,
        month,
        user_id: user.id,
      }, {
        onConflict: 'account_id,month'
      });

    if (upsertError) {
      console.error('Budget save error:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Budget save error:', err);
    return false;
  }
}, []);
```

## Technical Details

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Edge function 400 errors | Deployed version was outdated | Redeployed edge function (done) |
| TypeScript build error | Missing `user_id` in upsert | Add user authentication and include user_id |

## Expected Result
- All three features (Budget Pacing, Creative Fatigue, Audience Expander) will work correctly
- The build error will be resolved
- Budget data will be properly associated with the authenticated user
