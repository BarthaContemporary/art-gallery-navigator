

# Performance Optimization Plan

## Issues Identified

### 1. SecurityProvider runs heavy validation on every app load
The `SecurityProvider` runs `securityValidator.validateSystemSecurity()` and `securityDashboard.generateDashboard()` on mount. These make **multiple Supabase queries** (checking RLS, scanning tables, validating data exposure, checking encryption) -- all blocking the initial render pipeline. The security dashboard internally calls the validator **again**, doubling the work.

### 2. SecurityProvider monkey-patches `window.fetch` with security headers
Every single `fetch` call goes through `applyEnhancedSecurityHeaders()`, which adds headers like `Cross-Origin-Embedder-Policy: require-corp` and `Cache-Control: no-cache, no-store`. These headers:
- **Break caching entirely** (`Cache-Control: no-cache, no-store, must-revalidate, private`) for all requests including images and static assets
- `Cross-Origin-Embedder-Policy: require-corp` can block cross-origin resources (images from Supabase storage)

### 3. Dashboard makes 7+ sequential Supabase queries
`useDashboardStats` runs two batches of `Promise.allSettled` calls, then **three more sequential queries** (security_events, artworks status, profiles). These should all be parallelized.

### 4. No route-level code splitting
All 30+ pages are eagerly imported in `App.tsx`. Every page's JavaScript loads on initial app startup regardless of which route the user visits.

### 5. `useArtworkActions` hook called per card AND in GlobalDialogRenderer
Every `ArtworkCard` calls `useDialogManager()` and `useArtworkActions(artwork)`, which creates state and a `useQueryClient()` call per card. The `GlobalDialogRenderer` also always calls `useArtworkActions` even when no dialog is open.

### 6. `useUserRoles` wraps role checks in `enhancedSecurity.secureDataAccess`
This generates security log events (including `console.log`) for every role check, adding overhead to every login.

### 7. Virtualized grid is disabled
`ArtworkGrid` has `shouldUseOptimizedGrid = false` hardcoded, meaning all artwork cards render at once regardless of count.

---

## Proposed Changes

### Phase 1: High-Impact, Low-Risk

**1a. Lazy-load routes in `App.tsx`**
- Wrap all page imports with `React.lazy()` and `Suspense`
- Group related pages (CRM, admin, viewer) for shared chunks
- Estimated impact: 50-70% reduction in initial bundle size

**1b. Defer SecurityProvider validation**
- Move `validateSecurity()` call behind a `setTimeout(..., 5000)` so it runs after the app is interactive
- Remove the `window.fetch` monkey-patch -- these headers are not effective on client-side fetched requests (they're response headers, not request headers) and the `Cache-Control: no-store` actively hurts performance
- Estimated impact: Eliminates 4-6 Supabase queries from startup

**1c. Parallelize dashboard queries**
- Combine the second batch of admin queries and the subsequent sequential queries into a single `Promise.allSettled` call
- Estimated impact: Reduces dashboard load time by ~40%

### Phase 2: Medium Impact

**2a. Re-enable virtualized grid with a threshold**
- Change `shouldUseOptimizedGrid` to `artworks.length > 50` so large collections use virtualization
- Estimated impact: Major improvement for users with 100+ artworks

**2b. Remove `useArtworkActions` from `GlobalDialogRenderer` when no dialog is open**
- Only instantiate the hook when `isOpen && artwork` is truthy, or restructure to avoid the hook call
- Move `useArtworkActions` into the delete handler component only

**2c. Simplify `useUserRoles`**
- Remove the `enhancedSecurity.secureDataAccess` wrapper around role checking -- it adds logging overhead with no security value for an RPC call
- Call `supabase.rpc('has_role', ...)` directly

### Phase 3: Lower Priority

**3a. Remove `console.log` from SecurityMonitor in production**
- The `logSecurityEvent` method always logs to console (`console.log('Security Event:', securityEvent)`), adding noise and minor overhead

**3b. Add `loading="lazy"` to off-screen images**
- The `UnifiedImage` component should pass `loading="lazy"` to the img element for non-priority images

**3c. Memoize `CurrencyContext` value**
- Wrap the context value object in `useMemo` to prevent unnecessary re-renders of all consumers

## Technical Details

### Files to modify:
1. **`src/App.tsx`** -- Add `React.lazy` + `Suspense` for all route pages
2. **`src/components/security/SecurityProvider.tsx`** -- Defer validation, remove fetch monkey-patch
3. **`src/hooks/use-dashboard-stats.ts`** -- Parallelize all queries into one batch
4. **`src/components/artworks/ArtworkGrid.tsx`** -- Re-enable virtualized grid for large datasets
5. **`src/components/artworks/dialogs/GlobalDialogRenderer.tsx`** -- Restructure to avoid unnecessary hook calls
6. **`src/hooks/use-user-roles.ts`** -- Remove `enhancedSecurity.secureDataAccess` wrapper
7. **`src/utils/security-monitoring.ts`** -- Guard `console.log` behind dev check
8. **`src/components/ui/unified-image.tsx`** -- Add `loading="lazy"` attribute
9. **`src/contexts/CurrencyContext.tsx`** -- Memoize context value

### No database changes required
### No edge function changes required

