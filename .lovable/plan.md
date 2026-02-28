

## Plan: Simplified 360° Panorama Stitching & Viewer

### Root Cause
The edge function's deployed version used `gemini-3-pro-image-preview`, which returns **text descriptions** instead of images. The `gemini-2.5-flash-image` model does return images, but asking it to stitch 6-8 photos in one shot overwhelms it. The client-side "sliced sphere" fallback also produces a poor visual result.

### New Approach: Pairwise Iterative Stitching

Instead of sending all images at once, stitch them **in pairs** iteratively:

```text
Step 1:  img1 + img2 → merged_A
Step 2:  merged_A + img3 → merged_B  
Step 3:  merged_B + img4 → merged_C
...until all images are combined into one panorama
```

This keeps each AI call simple (merge 2 overlapping images), which the model handles reliably.

### Implementation Steps

1. **Rewrite `stitch-panorama` edge function**
   - Use `google/gemini-2.5-flash-image` with `modalities: ["image", "text"]`
   - Implement iterative pairwise stitching: merge image 1+2, then result+3, then result+4, etc.
   - Each step sends only 2 images with a simple prompt: "Merge these two overlapping photographs into a single seamless wide panoramic image"
   - Upload intermediate results to storage to pass URLs (not base64) between steps
   - Final result stored as before in `tour-uploads/stitched/{node_id}/panorama.png`
   - Add progress tracking: update `stitch_status` with step count

2. **Simplify `SphericalPanoramaViewer.tsx`**
   - Remove the `SlicedScene` component entirely (broken approach)
   - Keep only `EquirectangularScene` for displaying the AI-stitched panorama
   - When no stitched panorama exists, show a prompt to trigger AI stitching instead of the broken sliced view
   - Keep controls: auto-rotate, fullscreen, drag-to-look

3. **Simplify `TourViewerPage.tsx` viewer modes**
   - Remove `"spherical"` as a separate view mode
   - When a stitched panorama URL exists, show a "360°" button that renders `SphericalPanoramaViewer` in the main area
   - The Wand button triggers stitching; once done, automatically switch to 360° view
   - Default to `"single"` image view for nodes without a stitched panorama

### Technical Details

- **Pairwise merge prompt**: Keep it minimal — "Seamlessly merge these two overlapping photographs into one wider panoramic image. Preserve all detail. Output a single photograph."
- **Intermediate storage**: Upload each intermediate merge to `tour-uploads/stitched/{node_id}/step_{i}.png` so the next step can reference a URL rather than a huge base64 string
- **Error handling**: If any step fails, retry that step once. If it fails again, save whatever was produced up to that point as the result
- **Rate limiting**: Add a 2-second delay between AI calls to avoid 429 errors

