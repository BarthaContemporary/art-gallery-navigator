

## Analysis: Gaussian Splatting vs Current Approach

### The core problem
The AI image generation model is hallucinating — it changes, adds, or distorts content from the composer strip instead of faithfully preserving it. This is an inherent limitation of using generative AI for what should be a geometric transformation.

### Gaussian Splatting: Not viable here

Gaussian Splatting requires a **training pipeline** (COLMAP for camera pose estimation + GPU-intensive optimization) that takes minutes to hours on powerful hardware. It produces a 3D point cloud from dozens of overlapping photos with varying viewpoints. Your workflow captures a **single ring of photos at the same height** — this doesn't provide the multi-view parallax data that 3DGS needs. You'd need:

1. A backend GPU server (not possible in edge functions)
2. Many more photos from different heights/angles
3. Minutes of processing time per scene

This is a fundamentally different capture methodology.

### Better solution: Remove AI entirely, use geometric projection

The real issue is that we're using AI where math would suffice. The composer strip already covers 360° horizontally. To make it equirectangular, we only need to:

1. **Stretch the strip to 2:1 aspect ratio** using canvas — no AI needed
2. **Fill top/bottom bands** with a simple gradient sampled from the strip edges (ceiling/floor are rarely important for the immersive feel)
3. **Apply cylindrical-to-equirectangular correction** so the projection maps correctly onto the sphere

This approach is:
- **Instant** (runs in-browser, no edge function call needed)
- **100% faithful** to the composer output — zero hallucination
- **Free** — no AI credits consumed

### Implementation plan

1. **Create a client-side `stitchPanoramaLocally()` utility** in `src/lib/tours/panorama-stitcher.ts`:
   - Takes the saved panorama strip URL
   - Loads it onto a canvas
   - Stretches to 2:1 ratio, filling top/bottom with edge-sampled gradients
   - Applies cylindrical→equirectangular warp (pixel remapping)
   - Exports as a high-quality JPEG blob

2. **Upload the result to Supabase Storage** from the client side (same `tour-uploads` bucket, same path pattern)

3. **Update `TourViewerPage.tsx`** to call this local stitcher instead of invoking the edge function, updating `stitched_panorama_url` and `stitch_status` directly

4. **Keep the edge function as fallback** but default to client-side processing

5. **Update SphericalPanoramaViewer** — no changes needed, it already renders any equirectangular image

### Technical detail: cylindrical → equirectangular warp

The strip is a cylindrical projection (constant vertical scale). Equirectangular requires latitude-based vertical compression toward the poles. The pixel remapping formula:

```text
For each output pixel (x, y) in the 2:1 image:
  longitude = (x / width) * 2π
  latitude  = (y / height) * π - π/2
  
  // Map back to strip coordinates
  strip_x = (longitude / 2π) * strip_width
  strip_y = (latitude / vertical_fov) * strip_height + strip_center_y
```

The top ~20% and bottom ~20% will be gradient-filled (sky/ceiling and floor), and the middle 60% maps the strip content with the warp correction.

