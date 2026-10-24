# Project notes for Claude

Gallery management system for Joost van den Bergh (UK dealer, Japanese/Indian art):
a Next.js 15 studio app + public website on a self-hosted Supabase backend.

## Standing rules

- **Label PDFs**: whenever asked to produce mailing/label PDFs, first ask which
  **Avery number** to target (e.g. L7160/L7162/L7163), then generate the PDF to
  that exact label layout and optimise the sheet (margins, pitch, per-label size).
- **Applying DB migrations to the live server**: through the SSH tunnel
  (`docs/ops/security-runbook.md` step 5.4, `supabase/README.md`). The
  postgres-meta `/pg/query` route on the gateway is being closed (runbook
  step 5): it gives full SQL to anyone holding the service key. The change is
  invisible to the REST API until the schema cache reloads, so every migration
  must end with `notify pgrst, 'reload schema';` (or run it separately), or new
  tables/columns/functions return 404/500. Run `pnpm test:db` before applying.
- **Website sync**: DB triggers write `sync_outbox`; a pg_net trigger POSTs to the
  studio `/api/sync/sanity` at once (secret in `sync_config`), cron drains every
  10 min as fallback. Works publish only when `web_visible`; makers publish
  unless `web_visible` is switched off; inventory lists sync as `workList`
  docs only when `piece_lists.web_visible` ("List on website" switch on the
  list page), carrying web-visible members only; switching it off deletes
  the Sanity doc. Events may reference lists through `workLists`. Works publish only their website photographs (roles front, side, signature, box, detail; `apps/studio/src/lib/website-images.ts`), and the hourly `/api/cron/sanity-assets` deletes image assets the sync uploaded once nothing references them. A maker's
  portrait carries `makers.portrait_focus` (face position found by
  `apps/studio/src/lib/face` when the portrait is processed, or on first
  sync); the sync writes it as the Sanity hotspot and the site frames the
  black-and-white portrait square on it. Without a portrait the square is a
  detail of the newest published work, or failing that of the maker's entry
  in the newest past-exhibition catalogue (`artistTileFields` in
  `apps/web/src/lib/sanity.ts`), also black and white; works everywhere
  else stay in colour.
- **Work squares**: the website draws a work's tile from `work.presentation`
  and `work.tile`, both written by the sync. `pieces.presentation` (auto /
  flat / object / photo, the "Website square" select on the piece form) is
  the owner's choice; on auto the sync reads the first photograph
  (`apps/studio/src/lib/squares`): a flat work cropped to its edges is
  fitted whole on white by the site; an object on the studio backdrop gets a
  rendered 1600 px square (centred on and sized by the object's body
  alone: the extent of its sharp edges, which a soft cast shadow or the
  backdrop's own lighting never has, an edge in a shadow's colours (the
  backdrop's own colour darkened) counting only when sharp, falling back
  to clear colour difference when a piece shows too few edges; the body's
  larger side 86% of the tile, margins 6.5% top and sides, 7.5% bottom, a
  wide low object set lower; shadows take what room the margins leave;
  backdrop and any shadow running off the frame continued with the
  photograph's own grain); a room photograph (piece on a table against a
  wall, no clean backdrop) gets the largest square inside the photograph,
  nothing invented, centred across on the piece and moved up from the
  centred framing only to keep the piece's top. Both renders are kept
  in `piece-derivatives` as `<piece>/<image>.sq-<w>x<h>.jpg` and published
  as `tile`. `piece_image_squares` remembers the guess and the render per
  master size, so nothing is redone until the master changes. The fold-out
  panel and the full-screen view always show the whole photograph; full
  screen swaps in the largest rendition (up to 4096 px, the image worker's
  display-master cap, live since 10 October 2026).
- **Artist pages**: `ARTISTS_UNDER_CONSTRUCTION` in `apps/web/src/lib/site.ts`
  is the one switch that hides or restores the whole artist section; do not
  add artist links that bypass it.
- **Personal data**: any new table or column holding personal data needs a row in
  `retention_policies` (+ `apply_retention()`), coverage in `erase_contact()` and
  `lib/contact-export.ts`, and a line in `docs/compliance/ROPA.md` and the
  Privacy Notice. New third-party services go in `docs/compliance/PROCESSORS.md`
  and the notice's "Who we share it with". No new tag outside the consent gate.
- Autosave forms PATCH `new FormData(formRef)` to an API route on input/change;
  new hidden fields must be parsed on the server route AND the `savePiece` action.

## Security rules (from the October 2026 security review)

- Every API route and server action checks the session AND the role it needs
  before it touches the service client; a page having checked is not enough.
- A storage path read from a database row is never handed to a service-role
  storage call unchecked: use `safeStoragePath` (`@jvb/db/storage-path`) or the
  per-column helpers in `apps/studio/src/lib/storage-paths.ts`. Migration 0090's
  triggers refuse odd path shapes from signed-in users.
- Public endpoints (website forms, offer passwords, sign-in starts) and AI
  routes use `rateLimit()` / `hashKey()` from `@jvb/db/rate-limit` (hashes,
  never raw IPs or emails, in keys). Client IP: `x-real-ip` or the first
  `x-forwarded-for` entry, never `cf-connecting-ip` (not behind Cloudflare).
- Stored or user-supplied HTML: sanitise on write AND on read; preview it only
  in `<iframe sandbox="">`. Newsletter links pass `safeUrl` (http(s)/mailto).
- CSV exports go through `apps/studio/src/lib/csv.ts`. Financial exports are
  downloads only, never copied to the shared drive. The shared calendar is for
  admin and staff only.
- AI routes: admin/staff only, a per-user limit, and an AI draft never saves
  or publishes itself.
- Database: new functions get `revoke execute … from public` (0093 also
  changed the default) and grants only to the roles that call them; every RLS,
  grant or function change gets a test in `scripts/db-harness/tests` and
  `pnpm test:db` must pass. Unit tests: `pnpm test:unit`.
- The auth server, Caddy and key rotation are hardened by hand on the VPS:
  `docs/ops/security-runbook.md`.

## Money / VAT

Purchase £ is entered by hand; only the sale £ auto-converts from the spot rate
on the sale date. VAT-due display: margin scheme = 1/6 of (sale − total cost);
standard = 1/6 of sale; zero-rated / outside-scope = 0. Net = sale − VAT.
