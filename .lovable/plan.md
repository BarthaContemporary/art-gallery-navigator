

## Plan: Two-Step Panorama Workflow with Manual Overlap Adjustment

### New Workflow

```text
Step 1: PANORAMA COMPOSER (Client-side)
┌────────────────────────────────────────────────┐
│  Images laid side-by-side on a canvas          │
│  ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐            │
│  │1 ││2 ││3 ││4 ││5 ││6 ││7 ││8 │            │
│  └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘            │
│  ← drag images to adjust overlap →            │
│  [Save Panorama Strip]                         │
└────────────────────────────────────────────────┘
              ↓ saved as flat wide image
Step 2: AI SPHERICAL CONVERSION (Edge Function)
┌────────────────────────────────────────────────┐
│  Send panorama strip to Gemini 2.5 Flash Image │
│  Prompt: "Convert this wide panoramic photo    │
│  into a seamless 2:1 equirectangular           │
│  projection suitable for 360° viewing"         │
└────────────────────────────────────────────────┘
              ↓ equirectangular image
Step 3: SPHERICAL VIEWER (Existing)
┌────────────────────────────────────────────────┐
│  Three.js sphere with equirectangular texture  │
│  Pan + zoom + auto-rotate                      │
└────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Create `PanoramaComposer.tsx` component**
   - Displays all node images side-by-side horizontally in a scrollable canvas area
   - Each image is draggable left/right to adjust overlap with neighbors (using mouse/touch drag)
   - Overlap amount shown as a visual indicator (e.g. slider per image or direct drag handles)
   - "Save Panorama" button that composites all images at their current positions into a single wide image using HTML Canvas, uploads to Supabase Storage as `panorama-strip/{node_id}.jpg`
   - Saves the strip URL to `tour_nodes.panorama_strip_url` (new column)

2. **Add `panorama_strip_url` column to `tour_nodes`**
   - New nullable text column to store the manually composed panorama strip

3. **Update `stitch-panorama` edge function**
   - Instead of pairwise merging multiple images, now accepts the single panorama strip URL
   - Sends it to Gemini 2.5 Flash Image with prompt: "Convert this wide panoramic photograph into a seamless equirectangular (2:1 aspect ratio) projection for 360° spherical viewing. Fill in the top (sky/ceiling) and bottom (floor/ground) naturally."
   - Single AI call instead of iterative — simpler and more reliable
   - Stores result as before in `stitched_panorama_url`

4. **Simplify `TourViewerPage.tsx`**
   - Remove `immersive` and `3d` view modes — keep only `single`, `composer`, and `360`
   - `single`: current image-by-image view with thumbnails
   - `composer`: the new PanoramaComposer for arranging images
   - `360`: spherical viewer (only available after AI conversion)
   - Toolbar: Single | Composer | Wand (AI convert) | 360°

5. **Keep `SphericalPanoramaViewer.tsx` as-is**
   - Already works correctly for equirectangular images with pan/zoom/fullscreen

### Technical Details

- **Canvas compositing**: Use `document.createElement('canvas')`, draw each image at its computed x-offset, then `canvas.toBlob()` for upload
- **Drag overlap**: Track each image's x-offset in state; constrain so images stay in order; allow negative overlap (gap) or positive overlap (blending)
- **Mobile**: Horizontal scroll + pinch zoom on the composer; touch-drag for image repositioning
- **AI prompt**: Single call with the pre-composed strip is far more reliable than multi-image merging

