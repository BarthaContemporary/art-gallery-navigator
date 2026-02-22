

## Artist Selection Landing Page for Artworks

### Overview
Add an artist selection layer to the Artworks page. When you first visit `/artworks`, you'll see a clean list of artist names arranged in three columns. Clicking an artist name filters the inventory to show only their works. The existing toolbar (create, upload, import, etc.) and filters remain at the top throughout.

### How It Will Work

1. **Default state (no artist selected):** The artworks page shows the artist name list in a three-column layout, sorted alphabetically by surname. Each name is clickable.

2. **After selecting an artist:** The artist list is replaced by the artwork grid showing only that artist's works. A clear indicator shows which artist is selected, with a "Back to all artists" / "Show all" button to return to the selection view.

3. **URL integration:** Selecting an artist sets the `?artist=id` URL parameter (already supported by the existing filter system). Arriving at `/artworks?artist=xxx` goes straight to that artist's works.

4. **Existing navigation preserved:** The top bar with Create, Quick Upload, New Collection, Export, Import buttons stays visible at all times.

---

### Technical Details

**New component: `src/components/artworks/ArtistSelectionGrid.tsx`**
- Receives the artists list and an `onSelectArtist` callback
- Renders a responsive three-column grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) of artist names
- Groups by surname first letter with letter headers (A, B, C...)
- Each name is a clickable button/link that calls `onSelectArtist(artistId)`
- Mobile-optimised with appropriate touch targets and spacing

**Modified: `src/pages/Artworks.tsx`**
- When `filters.artist` is `null` (no artist selected), render `ArtistSelectionGrid` instead of the `ArtworkFilters` + `ArtworkGrid` section
- When an artist is selected, show the existing filtered grid view with a "Back to artists" button
- The header toolbar (Create, Upload, etc.) always remains visible above both views
- The search bar remains visible in both states (searching in the artist list view filters the artist names; in artwork view it filters artworks as before)

**Modified: `src/hooks/use-artwork-filters.ts`**
- Minor adjustment: ensure `hasActiveFilters` accounts for the `sortBy` default so the artist selection view isn't incorrectly flagged as "filtered"

### User Flow
1. Navigate to Artworks
2. See the top toolbar + a three-column alphabetical artist name list
3. Tap an artist name -> URL updates to `?artist=id`, grid shows that artist's works with all existing filters available
4. Tap "Show all artists" or clear the artist filter -> return to the artist selection list

