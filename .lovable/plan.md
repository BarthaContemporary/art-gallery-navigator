

# Guided Mobile Capture Wizard for PhotoTour Studio

## Overview

When a user creates or opens a tour project on a mobile device, a "Capture Mode" button launches a step-by-step wizard that guides them through photographing a space. The wizard uses the device camera via `<input type="file" capture="environment">` (no native app required), walks them through creating scan positions one by one, and auto-uploads each photo as it's taken.

## User Flow

```text
┌──────────────────────────────┐
│  Tour Detail Page (mobile)   │
│                              │
│  [📷 Start Capture Mode]     │  ← Only shown on mobile
│                              │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Step 1: Position Setup      │
│                              │
│  "Name this position"        │
│  [Entrance Hall        ]     │
│  Type: ○ Image Set ○ Pano    │
│                              │
│  [📷 Take Photo]             │
└──────────┬───────────────────┘
           │  photo taken
           ▼
┌──────────────────────────────┐
│  Step 2: Review & Continue   │
│                              │
│  ┌────────────────────┐      │
│  │   captured image    │      │
│  └────────────────────┘      │
│  ✓ 1 photo captured          │
│                              │
│  [📷 Add Another Photo]      │
│  [✓ Done with this spot]     │
└──────────┬───────────────────┘
           │  done
           ▼
┌──────────────────────────────┐
│  Step 3: Next Position?      │
│                              │
│  ✓ Entrance Hall (3 photos)  │
│                              │
│  [📷 Add Next Position]      │
│  [✓ Finish Capture]          │
└──────────────────────────────┘
```

## What Gets Built

### 1. New component: `src/components/tours/MobileCaptureWizard.tsx`

A full-screen mobile wizard with these states:
- **Position naming**: Text input for the scan position name + type selector (image set / panorama)
- **Camera capture**: Uses `<input type="file" accept="image/*" capture="environment">` to open the native camera. Each photo auto-uploads to the `tour-uploads` bucket and creates a `tour_node_images` record
- **Review**: Shows thumbnails of captured photos for the current position, with options to retake/delete or add more
- **Summary between positions**: Shows completed positions with photo counts, option to add another position or finish
- Progress indicator at top (position count)
- Tips overlay for each step (e.g. "Stand in the centre of the room", "Overlap photos by 30%", "Keep the camera level")

Key implementation details:
- Uses existing upload logic from `TourNodeEditorPage.tsx` (upload to `tour-uploads` bucket, insert into `tour_node_images`)
- Creates `tour_nodes` records as the user names each position
- Haptic feedback via `navigator.vibrate()` on capture success
- Large, thumb-friendly touch targets (min 48px)
- Landscape orientation hint when appropriate

### 2. Modified: `src/pages/tours/TourDetailPage.tsx`

- Import `useIsMobile` hook
- When on mobile, show a prominent "Start Capture Mode" button at the top of the page (below header, above nodes list)
- When capture mode is active, render `MobileCaptureWizard` as a full-screen overlay
- On wizard completion, invalidate queries to refresh the node list

### 3. New component: `src/components/tours/CaptureGuidanceOverlay.tsx`

A small helper that shows contextual tips during capture:
- For image sets: "Take 8-12 overlapping photos around the room"
- For panoramas: "Hold phone upright and rotate slowly"
- Shows a shot counter ("Photo 3 of ~10")
- Dismissable, remembers dismissal in localStorage

## Technical Details

- No new dependencies required. The `capture="environment"` HTML attribute opens the native camera on mobile browsers (iOS Safari, Chrome Android) without needing any camera API
- Uses the existing `useIsMobile()` hook to conditionally show the capture button
- All uploads go through the existing `tour-uploads` storage bucket with the same path convention: `tours/{projectId}/{nodeId}/{uuid}.{ext}`
- Node and image creation reuses the same Supabase insert patterns already in `TourNodeEditorPage.tsx`
- The wizard is a controlled component receiving `projectId` and `onComplete` callback
- No database changes needed -- uses existing `tour_nodes` and `tour_node_images` tables

