

# Fix: Build Error and Creative Images Not Showing

## Two Issues Found

### Issue 1: Build Error (Blocking Deployment)
There is an extra closing brace `}` on line 3015 of `supabase/functions/linkedin-api/index.ts`. This was introduced during a previous edit that added image extraction to the `get_creative_names_report` action. The extra brace prematurely closes the `for` loop, causing all subsequent `case` statements (starting with `get_account_structure` at line 3100) to fall outside the `switch` block, breaking the entire file.

**Fix**: Remove the extra `}` on line 3015.

### Issue 2: Image Extraction Enhancement
The versioned Creatives API (`/rest/adAccounts/{id}/creatives/{urn}`) returns a `content` object, but for most Sponsored Content ads this object only contains a `reference` URN pointing to a UGC post or share -- it does NOT contain direct image URLs in the `content.media.downloadUrl` path the code currently checks (lines 1055-1072).

The `fetchShareContent` helper function (called in Step 6) correctly resolves images from UGC posts and shares. However, the versioned API individual lookup (Step 2) also tries to extract `content.media.downloadUrl` which almost never has the actual ad image for sponsored content.

The current logic at line 1321-1324 already falls back to share content images when the versioned API yields no `imageUrl`. So once the build error is fixed and the edge function deploys successfully, images should start appearing.

**Fix**: Remove the extra brace, redeploy, and add a debug log to confirm image resolution counts.

## Changes

### File: `supabase/functions/linkedin-api/index.ts`
- Remove the extra `}` on line 3015 that breaks the switch statement
- Add a log line after Step 6 in `get_creative_report` to count how many images were resolved

### Deployment
- Redeploy the `linkedin-api` edge function

## Technical Details

The problematic code structure (lines 3012-3019):
```text
// Current (broken):
                if (imgUrl) referenceImageCache.set(reference, imgUrl);
                }       // closes if (shareResp.ok)
              }         // closes else if (share)
            }           // <-- EXTRA BRACE - closes for loop early
          } catch (err) {

// Fixed:
                if (imgUrl) referenceImageCache.set(reference, imgUrl);
                }       // closes if (shareResp.ok)
              }         // closes else if (share)
          } catch (err) {
```

