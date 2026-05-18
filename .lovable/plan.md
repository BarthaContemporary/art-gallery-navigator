## Goal

Expose a public, read-only REST API so your Sanity-powered website can pull live inventory (artworks, prices/availability, artists) from this app.

## Approach

Build a single Supabase Edge Function `public-inventory-api` that:
- Runs without JWT (`verify_jwt = false`) — public.
- Requires header `x-api-key` validated against a new `inventory_api_keys` table (hashed keys, revocable, last-used tracking).
- Returns JSON only from public-safe views (`artworks_public_safe`, plus a new safe artist view) — never exposes private fields (cost, internal notes, contacts).
- Supports CORS so Sanity / your site can call it from anywhere.

## Endpoints (REST/JSON)

```
GET /artworks                  → list (paginated, filterable)
   ?status=available&artist_id=…&limit=50&cursor=…
GET /artworks/:id              → single artwork with images
GET /artists                   → list of artists
GET /artists/:id               → single artist + their artworks
GET /collections               → published collections (optional)
```

Each artwork payload includes: id, title, artist (id + name), year, medium_type, materials, dimensions (h/w/d, framed dims), price, currency, status, images (thumbnail/medium/large URLs).

## Database changes (one migration)

- New table `inventory_api_keys`: `id, name, key_hash, key_prefix, is_active, created_by, last_used_at, request_count, created_at`.
- RLS: only `gallery_admin` can manage keys.
- New view `artists_public_safe`: id, full_name, biography, nationality, birth/death year, image_url.
- Helper SQL function `validate_inventory_api_key(key text)` (security definer) returning the key row if active.

## Admin UI

New page `/settings/api-access`:
- List existing keys (name, prefix `inv_xxx…`, last used, request count, active toggle, revoke).
- "Generate new key" → shows full key once, copy-to-clipboard, with usage snippet for Sanity.
- Docs panel with example `fetch` calls for Sanity Studio / frontend.

## Security

- Keys generated with `crypto.randomUUID()` + prefix; only SHA-256 hash stored.
- Rate limit per key (simple in-memory counter; note for production upgrade).
- CORS `*` allowed (public read-only).
- No write endpoints. No price-hidden / unpublished artworks unless explicitly flagged.

## Out of scope

- GraphQL (chose REST).
- Webhooks back into Sanity on inventory changes (can be added later).
- Per-user OAuth.

## Files to add/change

- `supabase/migrations/<ts>_inventory_api.sql` (table, view, validator function, RLS).
- `supabase/functions/public-inventory-api/index.ts` (router, auth, handlers).
- `supabase/config.toml` → add `[functions.public-inventory-api] verify_jwt = false`.
- `src/pages/settings/ApiAccess.tsx` + route entry.
- `src/components/settings/ApiKeyManager.tsx` (list/create/revoke UI).
- `src/hooks/useInventoryApiKeys.ts`.

After approval I'll run the migration first, then add the function and UI.