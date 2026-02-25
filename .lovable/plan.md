

# Fix: Add Creative Thumbnails to Creative Performance Report

## Problem
The `CreativePerformanceReport.tsx` component has access to `imageUrl` on each `CreativePerformanceRow` but does not import or render the `CreativeThumbnail` component. No thumbnail column exists in the table.

## Changes

### `src/components/dashboard/CreativePerformanceReport.tsx`
1. **Import** `CreativeThumbnail` from `./CreativeThumbnail`
2. **Add a thumbnail column** in the table header (before "Creative Name")
   - In the top header row: add an empty `<th>` for the thumbnail column
   - In the sub-header row: add a narrow `<th>` labeled with an image icon or left blank
3. **Render thumbnail in each creative row** — add a `<td>` before the name cell containing `<CreativeThumbnail imageUrl={row.imageUrl} creativeName={row.creativeName} size={36} />`
4. **Add an empty `<td>`** in the campaign drill-down sub-rows to keep column alignment
5. **Add an empty `<td>`** in the totals row for alignment
6. **Update `COL_COUNT`** from `2 + PERIODS.length * 3 + 1` to `3 + PERIODS.length * 3 + 1` to account for the new column

This reuses the existing `CreativeThumbnail` component which already handles loading states, error fallbacks, and a click-to-expand full-size preview dialog.

