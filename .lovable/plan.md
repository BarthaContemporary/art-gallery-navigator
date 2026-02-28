

## Plan: Spherical Panorama Viewer from Multiple Images

### Problem
Currently the 8 uploaded images are displayed as a flat horizontal strip (ImmersiveStripViewer) or as floating planes in 3D space (Tour3DViewer). Neither provides a true 360° immersive experience.

### Approach
Create a new **SphericalPanoramaViewer** component that stitches the 8 overlapping images onto the inside of a 3D sphere using Three.js (already installed), allowing the user to look around freely as if standing inside the scene.

### How It Works

```text
┌─────────────────────────────────────────────┐
│  8 images → painted onto inside of sphere   │
│                                             │
│   img1  img2  img3  img4  img5 ... img8     │
│   ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐    ┌──┐    │
│   │  │──│  │──│  │──│  │──│  │ .. │  │    │
│   └──┘  └──┘  └──┘  └──┘  └──┘    └──┘    │
│            ↓                                │
│   Mapped as vertical slices on sphere       │
│   Each image covers 360°/N of longitude     │
│   with soft alpha-blended overlaps          │
│            ↓                                │
│   Camera at center, OrbitControls for       │
│   free look (drag to rotate, scroll zoom)   │
└─────────────────────────────────────────────┘
```

Each image becomes a curved "slice" on the inside of a sphere. The camera sits at the center. The user drags to look around — a true 360° experience.

### Implementation Steps

1. **Create `src/components/tours/SphericalPanoramaViewer.tsx`**
   - React Three Fiber `<Canvas>` with a sphere (radius ~500, inverted normals so textures face inward)
   - For each of the N images, create a partial-sphere mesh covering `360°/N` of longitude (with ~15% overlap on edges)
   - Load each image as a Three.js texture, UV-mapped to its slice
   - Apply alpha gradient at left/right edges of each slice for seamless blending
   - Camera at center with `OrbitControls` (no pan, only rotate + zoom)
   - Auto-rotate option, fullscreen toggle, gyroscope support on mobile

2. **Update `TourViewerPage.tsx`**
   - Add a new ViewMode `"spherical"` alongside existing `single`, `immersive`, `3d`
   - When a node has 3+ images, show a "360° View" button in the toolbar
   - Auto-select spherical mode when node has enough images for coverage
   - Wire up the new component with the `nodeImages` data

3. **Replace the current panorama viewer (for `node_type === "panorama"`)** 
   - The existing panorama code (lines 723-741) is just a static `<img>` with `minWidth: 200%` — not interactive at all
   - Replace with the same spherical viewer for single equirectangular images too

### Technical Details

- **Sphere geometry**: `SphereGeometry(500, 64, 32)` with `side: THREE.BackSide` (renders inside)
- **Slice approach**: Each image maps to a `CylinderGeometry` or custom partial-sphere with UV coordinates covering its angular range. Simpler alternative: use N `PlaneGeometry` meshes arranged in a cylinder, which approximates a sphere well for 8+ images
- **Blending**: Custom `ShaderMaterial` with alpha falloff at edges, or simpler `MeshBasicMaterial` with transparent textures where edges have gradient alpha baked via canvas
- **Controls**: `OrbitControls` with `enablePan=false`, `enableZoom` limited, `autoRotate` option
- **Mobile**: Touch drag to rotate, pinch to zoom. Optional DeviceOrientation for gyro look-around
- **Performance**: Use `medium_url` textures (not originals) for fast load; lazy-load remaining slices after first 3

