

# Fix Tour Preview + Auto-Stitch Immersive Viewer

## Problem Analysis

Two issues identified:

1. **Preview stuck on "Loading tour..."**: The viewer queries `tour_projects` with `.single()`, which returns a 406 error when RLS blocks access (e.g., unauthenticated users or when the auth token isn't properly forwarded). The viewer currently shows an infinite loading spinner instead of handling this gracefully. For your authenticated session, the query likely succeeds but the viewer may still fail to render images because all `thumbnail_url`, `medium_url`, and `large_url` fields are null -- it relies on `original_url` fallback but OpenSeadragon may fail to initialize if the image loading encounters CORS or timing issues.

2. **No immersive experience**: The current viewer shows images one at a time with prev/next navigation. With 8 overlapping photos of the entrance, there's no way to experience them as a continuous, immersive walkthrough.

## Plan

### 1. Fix TourViewerPage Loading Issues

**File: `src/pages/tours/TourViewerPage.tsx`**

- Add proper error handling to the project query (show error state instead of infinite spinner)
- Add `retry: 2` and error state UI with a "Go Back" button
- Fix the loading condition: currently `!project || nodes.length === 0` shows spinner forever if project query fails or has no nodes. Separate these into: loading state, error state, and empty-nodes state
- Ensure OpenSeadragon properly falls back to `original_url` and handles image load errors gracefully
- Add an `onerror` handler that shows the image as a plain `<img>` tag if OpenSeadragon fails

### 2. Build Immersive Panoramic Strip Viewer

**New file: `src/components/tours/ImmersiveStripViewer.tsx`**

When a node has multiple images (image_set type), add a new "Immersive" viewing mode that stitches all images into a continuous horizontal panoramic strip:

- Places all images side by side in a wide horizontal canvas
- Smooth drag-to-pan with momentum/inertia (using pointer events)
- Touch and mouse support with momentum scrolling
- Auto-pan option that slowly scrolls through the strip
- Zoom in/out support
- Smooth crossfade blending at image edges (CSS gradient masks on overlapping boundaries)
- Progress indicator showing position in the strip
- Fullscreen support

```text
┌─────────────────────────────────────────────────────────┐
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐...  │
│  │ img1 ││ img2 ││ img3 ││ img4 ││ img5 ││ img6 │     │
│  │      ││      ││      ││      ││      ││      │     │
│  └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘     │
│  ◄═══════════════ drag to pan ═══════════════════►     │
│                    ─────●──────                         │
│                   progress bar                          │
└─────────────────────────────────────────────────────────┘
```

### 3. Integrate Immersive Mode into the Viewer

**File: `src/pages/tours/TourViewerPage.tsx`**

- Add a view mode toggle in the top bar: "Single" (existing OpenSeadragon) vs "Immersive" (panoramic strip)
- Default to Immersive mode when a node has 3+ images
- The toggle shows as an icon button in the toolbar (Layers icon for single, Panorama icon for immersive)
- When in immersive mode, hide the bottom thumbnail strip (not needed since all images are visible)
- Keep the sidebar, hotspots, and node navigation working in both modes

### 4. Add "Auto-Stitch" Button to Tour Detail Page

**File: `src/pages/tours/TourDetailPage.tsx`**

- For image_set nodes with 3+ images, show a small indicator: "8 photos -- Immersive view ready"
- The Preview button already links to the viewer; the immersive mode activates automatically

### Technical Details

- No new dependencies. Uses pointer events API for drag/pan, CSS transforms for positioning, and `requestAnimationFrame` for smooth momentum
- Images load lazily as they scroll into view within the strip
- Mobile-optimized: full touch support, momentum scrolling, snap-to-image optional
- All existing viewer features (inspection mode, annotations, hotspots, keyboard nav) remain functional in single-image mode

