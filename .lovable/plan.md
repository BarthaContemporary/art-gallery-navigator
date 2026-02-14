

# Audio Library Module Plan

## Overview

Add an Issuu-style audio library with public browsing, admin management, embeddable micro-players, and Supabase Storage for MP3 files. The embed pages will be ultra-lightweight standalone routes outside the main app shell.

## Database Schema

### New Tables

**`audio_tracks`**
- `id` (uuid, PK)
- `slug` (text, unique, auto-generated)
- `title` (text, not null)
- `artist` (text)
- `series` (text)
- `description` (text)
- `tags` (text[])
- `duration_seconds` (integer)
- `date_published` (date)
- `cover_image_url` (text)
- `storage_key` (text) -- path in Supabase Storage `audio` bucket
- `visibility` (text, default 'public') -- 'public' or 'private'
- `created_by` (uuid, references auth.users)
- `created_at`, `updated_at` (timestamptz)

**`audio_collections`**
- `id` (uuid, PK)
- `slug` (text, unique, auto-generated)
- `title` (text, not null)
- `description` (text)
- `cover_image_url` (text)
- `visibility` (text, default 'public')
- `created_by` (uuid)
- `created_at`, `updated_at`

**`audio_collection_items`**
- `id` (uuid, PK)
- `collection_id` (uuid, FK -> audio_collections)
- `track_id` (uuid, FK -> audio_tracks)
- `position` (integer, not null)
- unique constraint on (collection_id, track_id)

### Storage Bucket

- Create `audio` bucket (public for public tracks, signed URLs for private)

### RLS Policies

- Public SELECT on tracks/collections where `visibility = 'public'`
- Authenticated SELECT for all tracks (admin sees private too)
- Admin-only INSERT/UPDATE/DELETE on all three tables

### Slug Generation Trigger

- Reuse the pattern from `generate_publication_slug()` to auto-generate slugs on insert

## Edge Function

**`audio-signed-url`** -- generates short-lived signed URLs for private tracks. Validates auth, checks track visibility, returns a signed Supabase Storage URL.

## Routes

### Public Routes (no auth required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/audio` | `AudioLibrary` | Browse tracks with search, tag filter, sort |
| `/audio/tracks/:slug` | `AudioTrackDetail` | Track page with player + embed code snippet |
| `/audio/collections/:slug` | `AudioCollectionPage` | Collection with playlist |
| `/embed/audio/track/:slug` | `AudioTrackEmbed` | Minimal 48-64px micro-player |
| `/embed/audio/collection/:slug` | `AudioCollectionEmbed` | Micro-player + playlist drawer |

### Admin Route (auth + admin required)

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/audio` | `AdminAudioPage` | Upload MP3, edit metadata, manage collections |

## Files to Create

### Pages
- `src/pages/audio/AudioLibrary.tsx` -- search, tags, grid of tracks/collections
- `src/pages/audio/AudioTrackDetail.tsx` -- full track view with embed code
- `src/pages/audio/AudioCollectionPage.tsx` -- collection playlist view
- `src/pages/audio/embed/AudioTrackEmbed.tsx` -- standalone minimal player
- `src/pages/audio/embed/AudioCollectionEmbed.tsx` -- minimal player + playlist
- `src/pages/admin/AdminAudioPage.tsx` -- upload, metadata form, collection manager

### Components
- `src/components/audio/MicroPlayer.tsx` -- 48-64px player: play/pause, scrubber, time display. CSS variables for theming, ARIA labels, keyboard support
- `src/components/audio/AudioTrackCard.tsx` -- card for library grid
- `src/components/audio/AudioUploadForm.tsx` -- MP3 upload + metadata fields
- `src/components/audio/AudioCollectionManager.tsx` -- drag-to-reorder collection items

### Hooks
- `src/hooks/use-audio-tracks.ts` -- CRUD queries for tracks
- `src/hooks/use-audio-collections.ts` -- CRUD queries for collections
- `src/hooks/use-audio-player.ts` -- shared playback state (play/pause/seek/time)

### Edge Function
- `supabase/functions/audio-signed-url/index.ts`

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add lazy imports for 6 new pages; add routes (public `/audio/*`, `/embed/audio/*`, admin `/admin/audio`) |
| `src/components/layout/sidebar/Navigation.tsx` | Add "Audio" nav item with `Music` icon (admin-only) |
| `src/hooks/use-nav-items.ts` | Add "Audio" to `baseItems` and `mainItems` |
| `src/pages/admin/AdminLayout.tsx` | Add "Audio Library" to `adminNavItems` |
| `supabase/config.toml` | Register `audio-signed-url` function |

## Player UI Details

The `MicroPlayer` component:
- Height: 48-64px, flex row layout
- Controls: play/pause button, range input scrubber, current time / duration
- Uses native `<audio>` element (hidden), controlled via ref
- CSS variables: `--audio-player-bg`, `--audio-player-fg`, `--audio-player-accent` with sensible defaults
- Scoped styles using CSS modules or inline styles (no global CSS leakage)
- ARIA: `role="region"`, `aria-label="Audio player"`, button labels, keyboard Enter/Space for play/pause
- Focus ring on interactive elements

## Embed Page Strategy

The embed routes (`/embed/audio/*`) render **outside** the `MainLayout` and `RequireAuth` wrappers -- just like `/auth` and `/book-appointment`. They load only the `MicroPlayer` component with minimal dependencies (no sidebar, no providers beyond QueryClient). This keeps the iframe payload small.

## Performance Considerations

- All new pages lazy-loaded via `React.lazy`
- Embed pages import only MicroPlayer + Supabase client (tiny bundle)
- Audio files streamed directly from Supabase Storage (no buffering through edge functions for public tracks)
- Signed URLs only generated on-demand for private tracks
- `loading="lazy"` on cover images

