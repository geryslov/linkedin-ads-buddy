

## Problem

The `get_lead_form_responses` handler in the edge function returns LinkedIn API errors with their original HTTP status code (e.g., 403, 401). The Supabase client intercepts any non-2xx response and throws a generic "Edge Function returned a non-2xx status code" error, hiding the actual error details from the frontend.

This is the same pattern already documented and fixed for other actions in this edge function -- errors should be returned as HTTP 200 JSON with an `error` field.

## Fix

**File: `supabase/functions/linkedin-api/index.ts`** (line ~11095-11101)

Change the error response from:
```typescript
return new Response(JSON.stringify({
  error: `LinkedIn API error: ${leadsResp.status}`,
  details: errText.substring(0, 300),
}), {
  status: leadsResp.status,  // <-- THIS causes the problem
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

To:
```typescript
return new Response(JSON.stringify({
  error: `LinkedIn API error: ${leadsResp.status}`,
  details: errText.substring(0, 300),
}), {
  status: 200,  // Return 200 so Supabase client doesn't swallow the details
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

Then redeploy the edge function.

## Impact
- Single line change (`status: leadsResp.status` to `status: 200`)
- The frontend `useLeadFormResponses` hook already handles `data?.error` correctly, so error messages will now surface properly instead of the generic non-2xx message

