
# Fix Company Name Resolution: Completing the Implementation

## Problem Analysis

After investigating the codebase, I found several issues preventing company names from appearing:

1. **Cache is empty**: The `linkedin_company_cache` table has no entries yet, so nothing is being retrieved from cache
2. **Edge function not being called for company reports**: Recent logs only show `get_ad_accounts` calls - the `get_company_influence` and `get_company_engagement_timeline` endpoints haven't been invoked recently
3. **CompanyEngagementTimeline.tsx is incomplete**: The component still uses the old destructive red alert and is missing the inline editing feature for manual name overrides that was implemented in `CompanyInfluenceReport.tsx`

## Root Cause

The user is on the main route (`/`) and hasn't navigated to the Company Influence or Company Timeline tabs yet. When they do navigate there:
- The edge function will be called
- If LinkedIn API returns 403 for organization lookups, names won't be resolved
- The cache is empty, so there's nothing to fall back to
- The UI will show "Company 12345" IDs

## Required Changes

### 1. Update CompanyEngagementTimeline.tsx to Match CompanyInfluenceReport.tsx

The timeline component needs:
- Yellow warning alert instead of destructive red alert
- Import and use `updateCompanyName` from the hook
- Add inline editing with pencil icon for company names showing "Company {id}"
- Include the `normalizeCompanyUrn` helper function

```text
Location: src/components/dashboard/CompanyEngagementTimeline.tsx
Changes needed:
- Line 147-155: Replace destructive Alert with yellow warning
- Line 61-77: Add updateCompanyName from hook destructuring  
- Line 338-358: Add inline editing capability to company list items
- Add Pencil, Check, X imports from lucide-react
- Add Input import from @/components/ui/input
- Add normalizeCompanyUrn helper function
```

### 2. Add Inline Editing Component for Company Names

Create an `EditableCompanyName` component that:
- Shows company name with pencil icon for unresolved names
- Toggles to input field on click
- Saves to database on confirm
- Updates local state optimistically

### 3. Verify Edge Function Deployment

The edge function code looks correct but needs verification that:
- The `update_company_name` action is properly deployed
- Cache lookups and upserts work correctly

## Implementation Details

### File: src/components/dashboard/CompanyEngagementTimeline.tsx

#### Add missing imports
```tsx
import { Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
```

#### Add helper function
```tsx
function normalizeCompanyUrn(urn: string): { id: string | null } {
  if (!urn) return { id: null };
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) return { id: match[2] };
  const numericMatch = urn.match(/:(\d+)$/);
  return { id: numericMatch ? numericMatch[1] : null };
}
```

#### Update hook destructuring to include updateCompanyName
```tsx
const {
  // ... existing fields
  updateCompanyName,  // Add this
} = useCompanyEngagementTimeline(accessToken);
```

#### Replace the names resolution alert (lines 147-155)
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

#### Add EditableCompanyName component
```tsx
function EditableCompanyName({ 
  company, 
  onNameUpdate 
}: { 
  company: CompanyTimeline; 
  onNameUpdate?: (orgId: string, name: string) => Promise<{ success: boolean }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(company.companyName);
  const isUnresolved = company.companyName.startsWith('Company ');

  const handleSave = async () => {
    if (!editName.trim()) return;
    const { id } = normalizeCompanyUrn(company.companyUrn);
    if (id && onNameUpdate) {
      const result = await onNameUpdate(id, editName.trim());
      if (result.success) {
        setIsEditing(false);
      }
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="h-7 text-sm w-32"
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={isUnresolved ? 'text-muted-foreground' : ''}>
        {company.companyName}
      </span>
      {isUnresolved && onNameUpdate && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
          onClick={() => setIsEditing(true)}
          title="Edit company name"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
```

#### Update company list to use EditableCompanyName (around line 352)
Replace the simple `{company.companyName}` display with:
```tsx
<EditableCompanyName 
  company={company} 
  onNameUpdate={updateCompanyName} 
/>
```

#### Update the table to use EditableCompanyName (around line 462-464)
Replace the company name cell in the table with:
```tsx
<TableCell className="font-medium min-w-[200px]">
  <EditableCompanyName 
    company={company} 
    onNameUpdate={updateCompanyName} 
  />
</TableCell>
```

## Testing Steps

1. Navigate to the Company Influence or Company Timeline tab
2. Verify the edge function logs show `get_company_influence` or `get_company_engagement_timeline`
3. Check if the yellow warning appears instead of the red alert
4. If companies show as "Company 12345":
   - Click the pencil icon next to the name
   - Enter the real company name
   - Click the checkmark to save
5. Refresh the page and verify the name persists
6. Check the `linkedin_company_cache` table to confirm the entry was saved

## Expected Behavior After Fix

1. First load: LinkedIn API attempts to resolve names, may fail with 403
2. Yellow warning appears with guidance on manual naming
3. User can click pencil icon on any "Company 12345" entry
4. Entering a name and saving stores it in `linkedin_company_cache`
5. Future loads retrieve names from cache, no API call needed for cached companies
6. Over time, the cache fills up and fewer "Company {id}" entries appear
