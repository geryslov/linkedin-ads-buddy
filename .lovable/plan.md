

# Company Name Caching System: Multi-Source Resolution Pipeline

## Overview

This plan implements a persistent company name caching system that resolves names from multiple sources, stores them permanently, and allows manual overrides when LinkedIn API access is restricted.

---

## Architecture

```text
+---------------------------+
|  LinkedIn Analytics API   |
|  (returns company URNs)   |
+-----------+---------------+
            |
            v
+---------------------------+
|   Name Resolution Pipeline |
|                           |
|  Step A: Check DB Cache   |
|           |               |
|           v               |
|  Step B: LinkedIn API     |
|  (/v2/organizations/{id}) |
|           |               |
|           v               |
|  Step C: Fallback         |
|  (show ID, allow edit)    |
+-----------+---------------+
            |
            v
+---------------------------+
|   linkedin_company_cache  |
|   (Supabase table)        |
+---------------------------+
            ^
            |
+---------------------------+
|   Frontend: Inline Edit   |
|   (manual name override)  |
+---------------------------+
```

---

## Changes Summary

| Component | Change |
|-----------|--------|
| Database | Create `linkedin_company_cache` table with RLS policies |
| Edge Function | Add cache lookup (Step A) before LinkedIn API calls |
| Edge Function | Only query LinkedIn for missing IDs (Step B) |
| Edge Function | Upsert resolved names to cache after successful lookups |
| Edge Function | Improved fallback naming with `normalizeCompanyUrn` |
| Frontend Hook | Add `updateCompanyName` mutation for manual overrides |
| Frontend Component | Yellow warning instead of destructive alert |
| Frontend Component | Inline edit icon for "Company 12345" names |
| Frontend Component | Save edited names to database |

---

## Technical Implementation

### 1. Database Migration

Create a new table to cache company names with proper indexing:

```sql
CREATE TABLE linkedin_company_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vanity_name TEXT,
  source TEXT NOT NULL DEFAULT 'linkedin_org_api',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_linkedin_company_cache_org_id ON linkedin_company_cache(org_id);

ALTER TABLE linkedin_company_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company cache"
  ON linkedin_company_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert company cache"
  ON linkedin_company_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update company cache"
  ON linkedin_company_cache FOR UPDATE
  USING (auth.uid() IS NOT NULL);
```

**Source values**: `linkedin_org_api`, `manual`, `enrichment`, `historic`

---

### 2. Edge Function Changes

#### File: `supabase/functions/linkedin-api/index.ts`

##### Add Supabase Client Import (top of file)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
```

##### Update `get_company_influence` Handler

**Step A: Load cached names first** (insert after extracting `orgIds`)

```typescript
// Step A: Load cached names from Supabase first
const companyNames = new Map<string, string>();
try {
  const { data: cached, error: cacheError } = await supabaseClient
    .from('linkedin_company_cache')
    .select('org_id, name, vanity_name')
    .in('org_id', orgIds);

  if (!cacheError && cached) {
    console.log(`[get_company_influence] Loaded ${cached.length} cached company names`);
    cached.forEach(row => {
      const displayName = row.name || row.vanity_name || '';
      if (displayName) {
        companyNames.set(row.org_id, displayName);
        companyNames.set(`urn:li:organization:${row.org_id}`, displayName);
        companyNames.set(`urn:li:company:${row.org_id}`, displayName);
        companyNames.set(`urn:li:memberCompany:${row.org_id}`, displayName);
      }
    });
  }
} catch (e) {
  console.error('[get_company_influence] Cache lookup error:', e);
}
```

**Step B: Only resolve missing IDs via LinkedIn API**

```typescript
// Step B: Only query LinkedIn for IDs not in cache
const idsMissing = orgIds.filter(id => !companyNames.has(id));
console.log(`[get_company_influence] ${orgIds.length - idsMissing.length} from cache, ${idsMissing.length} need API lookup`);

if (idsMissing.length > 0) {
  // ... existing batch/individual lookup logic, but only for idsMissing
  // After successful lookup, upsert to cache
}
```

**Upsert resolved names to cache**

```typescript
// After each successful name resolution:
if (name) {
  // Store in memory maps (existing logic)
  companyNames.set(id, name);
  // ...

  // Also persist to cache
  try {
    await supabaseClient.from('linkedin_company_cache').upsert({
      org_id: id,
      name: name,
      vanity_name: vanityName || null,
      source: 'linkedin_org_api',
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'org_id' });
  } catch (e) {
    console.log(`[get_company_influence] Cache upsert failed for ${id}:`, e);
  }
}
```

##### Update `get_company_engagement_timeline` Handler

Apply the same 3-step pattern:
1. Load from cache first
2. Query LinkedIn only for missing
3. Upsert successful resolutions

##### Improve Fallback Naming Logic

Replace the current fallback logic with safer normalization:

```typescript
// Get company name - use multi-key lookup
const { id } = normalizeCompanyUrn(companyUrn);
const lookupKeys = [
  companyUrn,
  id ?? '',
  `urn:li:organization:${id}`,
  `urn:li:company:${id}`,
  `urn:li:memberCompany:${id}`,
].filter(Boolean);

let companyName = lookupKeys.map(k => companyNames.get(k)).find(Boolean);

if (!companyName) {
  companyName = id ? `Company ${id}` : 'Unknown Company';
}
```

##### Add New Action: `update_company_name`

For manual overrides from the frontend:

```typescript
case 'update_company_name': {
  const { orgId, name, source = 'manual' } = params || {};
  
  if (!orgId || !name) {
    return new Response(JSON.stringify({ error: 'orgId and name are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { data, error } = await supabaseClient
      .from('linkedin_company_cache')
      .upsert({
        org_id: orgId,
        name: name.trim(),
        source,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'org_id' })
      .select()
      .single();

    if (error) throw error;

    console.log(`[update_company_name] Saved name for ${orgId}: "${name}" (source: ${source})`);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('[update_company_name] Error:', e);
    return new Response(JSON.stringify({ error: 'Failed to save company name' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

---

### 3. Frontend Hook Updates

#### File: `src/hooks/useCompanyInfluence.ts`

Add a mutation function for manual name updates:

```typescript
const updateCompanyName = useCallback(async (orgId: string, name: string) => {
  try {
    const { data: result, error } = await supabase.functions.invoke('linkedin-api', {
      body: {
        action: 'update_company_name',
        params: { orgId, name, source: 'manual' }
      }
    });

    if (error) throw error;

    // Update local state optimistically
    if (data?.companies) {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          companies: prev.companies.map(c => {
            const { id } = normalizeCompanyUrn(c.companyUrn);
            return id === orgId ? { ...c, companyName: name } : c;
          })
        };
      });
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to update company name:', err);
    return { success: false, error: err };
  }
}, [data]);
```

Add helper function (or import from shared utils):

```typescript
function normalizeCompanyUrn(urn: string): { id: string | null } {
  if (!urn) return { id: null };
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) return { id: match[2] };
  const numericMatch = urn.match(/:(\d+)$/);
  return { id: numericMatch ? numericMatch[1] : null };
}
```

#### File: `src/hooks/useCompanyEngagementTimeline.ts`

Add the same `updateCompanyName` mutation pattern.

---

### 4. Frontend Component Updates

#### File: `src/components/dashboard/CompanyInfluenceReport.tsx`

##### Change Alert to Yellow Warning

Replace the destructive alert with a softer yellow warning:

```tsx
{data?.metadata?.namesResolutionFailed && (
  <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
    <AlertTriangle className="h-4 w-4 text-yellow-600" />
    <AlertTitle className="text-yellow-800 dark:text-yellow-200">
      Some Company Names Unavailable
    </AlertTitle>
    <AlertDescription className="text-yellow-700 dark:text-yellow-300">
      LinkedIn blocked automatic name resolution. Showing cached names and IDs for unknowns.
      Click the edit icon next to any "Company 12345" to set a name manually.
    </AlertDescription>
  </Alert>
)}
```

##### Add Inline Edit for Company Names

Update the `CompanyRow` component to show an edit icon for unresolved names:

```tsx
import { Pencil, Check, X } from 'lucide-react';

function CompanyRow({ company, isExpanded, onToggle, onNameUpdate }: {
  company: CompanyInfluenceItem;
  isExpanded: boolean;
  onToggle: () => void;
  onNameUpdate: (orgId: string, name: string) => Promise<{ success: boolean }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(company.companyName);
  const isUnresolved = company.companyName.startsWith('Company ');

  const handleSave = async () => {
    if (!editName.trim()) return;
    const { id } = normalizeCompanyUrn(company.companyUrn);
    if (id) {
      const result = await onNameUpdate(id, editName.trim());
      if (result.success) {
        setIsEditing(false);
      }
    }
  };

  return (
    <TableRow>
      {/* ... existing cells ... */}
      <TableCell className="w-48 font-medium">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
            />
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSave}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className={isUnresolved ? 'text-muted-foreground' : ''}>
              {company.companyName}
            </span>
            {isUnresolved && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                title="Edit company name"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
      {/* ... rest of cells ... */}
    </TableRow>
  );
}
```

#### File: `src/components/dashboard/CompanyEngagementTimeline.tsx`

Apply the same inline edit pattern for the company list section.

---

## Data Flow

```text
1. User loads Company Influence or Timeline tab
2. Edge Function extracts org IDs from analytics
3. Step A: Query linkedin_company_cache for known names
4. Step B: Call LinkedIn API only for missing IDs
5. Step C: For any still missing, show "Company {id}"
6. Upsert any newly resolved names to cache
7. Return data with names (from cache + API + fallback)

Manual Override Flow:
1. User sees "Company 12345" in table
2. Clicks pencil icon → inline edit
3. Types real name → clicks checkmark
4. Frontend calls update_company_name action
5. Edge Function upserts to linkedin_company_cache with source='manual'
6. Next load will show the manual name
```

---

## Benefits

| Before | After |
|--------|-------|
| Every request tries LinkedIn API | Cached names returned instantly |
| 403 = all IDs show as numbers | 403 = only new IDs need resolution |
| No way to fix names | Manual override persists forever |
| Destructive red alert | Friendly yellow warning with guidance |

---

## Testing Steps

1. Clear cache (optional) and load Company Influence
2. Check edge function logs for "Loaded X cached company names"
3. Verify companies with cached names appear correctly
4. Find a "Company 12345" entry and click the edit icon
5. Enter a real name and save
6. Refresh the page - the manual name should persist
7. Check the `linkedin_company_cache` table in the database

