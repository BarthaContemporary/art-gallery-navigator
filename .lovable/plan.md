

# Matterport-Style Tour Viewer — Full Rewrite Plan

## Overview

Rewrite the tour viewer into a clean, Matterport-inspired experience with 6 components: a rewritten TourViewerPage, PanoramaComposer, enhanced SphericalPanoramaViewer, plus 3 new components (TourFloorplanMinimap, TourNodeStrip, TourHotspot3D).

## Architecture

```text
TourViewerPage (full-screen layout)
├── Top bar: project title, view mode toggle, close
├── Main area:
│   ├── SphericalPanoramaViewer (360° mode, with TourHotspot3D children)
│   ├── Simple <img> viewer (single photo mode)
│   └── PanoramaComposer (composer mode)
├── TourNodeStrip (bottom center — horizontal thumbnail nav)
└── TourFloorplanMinimap (bottom-left — interactive dot map)
```

## File-by-File Plan

### 1. `src/pages/tours/TourViewerPage.tsx` — REWRITE (~500 lines)

**Remove**: OpenSeadragon dependency, AnnotationOverlay component, complex URL fallback chains, osdFailed state.

**Keep**: All data fetching (project, nodes, nodeImages, hotspots queries), stitch mutation + polling logic, keyboard navigation.

**New structure**:
- State machine: `viewMode: "photos" | "composer" | "360"`
- Simple `<img>` tag for photo viewing with `onError` → placeholder. No OSD.
- Fade transition state (`transitioning`) for node switches — 300ms black fade
- Always render `TourNodeStrip` and `TourFloorplanMinimap` as overlays
- Pass hotspots + `onNavigate` to SphericalPanoramaViewer
- Clean top bar: project title (left), view mode pills (center), close button (right)
- Remove inspection mode / annotation overlay (simplify for now)

### 2. `src/components/tours/SphericalPanoramaViewer.tsx` — ENHANCE

**Add props**: `hotspots`, `onHotspotClick`, `initialHeading`, `onTransitionStart`

**Changes**:
- Accept `initialHeading` prop → set OrbitControls initial azimuthal angle
- Render `TourHotspot3D` components inside the Three.js scene for each hotspot
- Add fade-in effect: start with black overlay, fade to transparent over 500ms
- Keep existing auto-rotate, fullscreen controls

### 3. `src/components/tours/TourHotspot3D.tsx` — NEW

A React Three Fiber component rendered inside the Canvas:
- Positioned on sphere interior using yaw/pitch → 3D coordinates
- Renders as a `<sprite>` with a circular texture (white ring + arrow)
- Pulses gently with animation
- On click → calls `onNavigate(targetNodeId)`
- Shows label on hover via HTML overlay (`<Html>` from drei)

### 4. `src/components/tours/TourNodeStrip.tsx` — NEW

Horizontal scrollable thumbnail strip at the bottom of the viewer:
- Shows one thumbnail per node (first image's `original_url`)
- Current node highlighted with white border + scale
- Click to navigate to node
- Semi-transparent dark background
- Auto-scrolls to keep current node visible
- Shows node name on hover

### 5. `src/components/tours/TourFloorplanMinimap.tsx` — NEW

Small interactive minimap (bottom-left corner, ~180×180px):
- If nodes have `floorplan_x`/`floorplan_y`, render dots on a dark card
- Current node = larger pulsing blue dot, others = smaller white dots
- Click dot → navigate to that node
- If floorplan image exists (from `tour_floorplans`), show as background
- If no nodes have coordinates, hide entirely
- Collapsible with a small map icon toggle

### 6. `src/components/tours/PanoramaComposer.tsx` — SIMPLIFY

**Keep**: Canvas-based overlap editor, drag handles, save strip, process 360° button.

**Fix**:
- Ensure `Save Strip` must be clicked before `Process 360°` — disable Process until strip is saved
- Add clear visual state: unsaved changes indicator
- Simplify toolbar to single row
- Keep error handling from previous fixes

## Data Flow

- **TourViewerPage** fetches all data, passes down via props
- **Node navigation**: `goToNode(idx)` triggers fade transition → updates `currentNodeIdx` → auto-selects best viewMode
- **Hotspot navigation**: SphericalPanoramaViewer → `onHotspotClick(targetNodeId)` → `goToNodeById()` with fade
- **Minimap navigation**: TourFloorplanMinimap → `onNodeSelect(idx)` → same flow
- **Strip navigation**: TourNodeStrip → `onNodeSelect(idx)` → same flow

## Key Decisions

- **No OpenSeadragon** — replaced with simple `<img>` for photo mode (images only have `original_url` populated, deep zoom adds complexity with no benefit)
- **No annotation overlay** in this rewrite (can be added back later)
- **Hotspots use yaw/pitch** for 3D positioning inside the sphere, `coord_x/coord_y` for 2D fallback
- **Smooth transitions**: CSS opacity transition on a black overlay div, toggled during node switches

## Dependencies

No new dependencies needed. Uses existing:
- `@react-three/fiber@^8.18`, `@react-three/drei@^9.122.0`, `three`
- `@tanstack/react-query`, `sonner`, `lucide-react`

