

## Issues Identified

### Issue 1: Node stuck in `stitch_status = "processing"` permanently
The database shows the node is stuck in `processing` state. The edge function has no logs, meaning it either was never deployed or failed silently. This causes:
- The "Process 360°" button to show a perpetual spinner (it checks `isStitching` which is `stitch_status === "processing" && !!panorama_strip_url`)
- The polling interval runs endlessly every 4 seconds (visible in the network requests)

### Issue 2: Images not loading in the viewer
The `getImageUrlCandidates` function prioritizes `large_url`, `medium_url`, `thumbnail_url`, then `original_url`. If these processed URLs are null or broken (common with Cloudinary-processed images), OpenSeadragon tries them one by one via `open-failed` handler, but the fallback logic can leave the viewer blank if all fail or if OSD initialization races with URL index changes.

### Issue 3: No way to reset a stuck processing state
There's no UI mechanism to reset a failed/stuck stitch operation, leaving the user permanently stuck.

---

## Plan

### 1. Deploy the stitch-panorama edge function
The function exists in code but has no logs, suggesting it was never deployed. Deploy it so the Process 360° workflow actually works.

### 2. Add stuck-processing recovery logic
In `TourViewerPage.tsx`, add a timeout mechanism: if `stitch_status` has been `"processing"` for longer than ~90 seconds of polling without completing, automatically reset it to `"failed"` and show an error toast. Also add a "Retry" affordance on the Process 360° button when status is `"failed"`.

Immediately fix the current stuck node by resetting its `stitch_status` to `null` via a one-time DB update triggered from the UI (or just reset it now so the user can proceed).

### 3. Fix image loading reliability in single view mode
In `TourViewerPage.tsx`, modify `getImageUrlCandidates` to prioritize `original_url` first (most reliable), then fall back to processed variants. This ensures the base image always loads even if Cloudinary processing hasn't completed.

### 4. Add error handling to Process 360° button in PanoramaComposer
Wrap `onProcess` in `try/catch` within the composer. If the mutation fails, ensure the button re-enables properly. Currently `canProcess` depends on `isStitching` which stays true if the edge function never responds.

### 5. Reset stuck DB state
Reset the stuck node's `stitch_status` from `"processing"` to `null` so the user can re-trigger the process.

---

## Technical Details

**File changes:**

1. **`src/pages/tours/TourViewerPage.tsx`**:
   - Reorder `getImageUrlCandidates` to put `original_url` first: `[original_url, large_url, medium_url, thumbnail_url]`
   - Add a polling timeout counter: after ~20 polls (80 seconds) with no status change, reset `stitch_status` to `failed` via DB update and show error toast
   - When `stitch_status === "failed"`, show the Wand button as enabled (not spinning) so user can retry
   - Fix `isStitching` to also consider `stitchMutation.isPending` to prevent double-clicks

2. **`src/components/tours/PanoramaComposer.tsx`**:
   - Wrap `onProcess` call in proper error boundary
   - No major structural changes needed

3. **Deploy edge function**: Run deployment for `stitch-panorama`

4. **DB fix**: Reset the stuck node via SQL update

