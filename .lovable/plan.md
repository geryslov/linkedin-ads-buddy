

# Remove Hardcoded Form Name Overrides

## Problem
Lines 5288–5308 contain a hardcoded `knownFormNames` map that overrides API-resolved form names. The Lead Sync API (`/rest/leadGenForms`) already returns form names, so this override is unnecessary and prevents the real API names from showing.

## Plan

### Single change in `supabase/functions/linkedin-api/index.ts`

**Delete lines 5288–5308** — the entire `knownFormNames` block and its application loop:
```typescript
// Step 3c: Hardcoded canonical names for known form IDs — always override API-resolved names
const knownFormNames: Record<string, string> = { ... };
for (const [formId, formName] of Object.entries(knownFormNames)) {
  lgfFormNames.set(formId, formName);
}
```

The existing API resolution code (Steps 3, 3b) already populates `lgfFormNames` with names from the `/rest/leadGenForms` endpoint and individual fallback lookups. Removing the override lets those API-sourced names flow through.

### After
Redeploy the `linkedin-api` edge function.

