# Project notes for Claude

Gallery management system for Joost van den Bergh (UK dealer, Japanese/Indian art):
a Next.js 15 studio app + public website on a self-hosted Supabase backend.

## Standing rules

- **Label PDFs**: whenever asked to produce mailing/label PDFs, first ask which
  **Avery number** to target (e.g. L7160/L7162/L7163), then generate the PDF to
  that exact label layout and optimise the sheet (margins, pitch, per-label size).
- **Applying DB migrations to the live server**: after running any migration via
  the postgres-meta `/pg/query` endpoint, the change is invisible to the REST API
  until the schema cache reloads. Every migration must end with
  `notify pgrst, 'reload schema';` (or run it separately), or new
  tables/columns/functions return 404/500.
- **Website sync**: DB triggers write `sync_outbox`; a pg_net trigger POSTs to the
  studio `/api/sync/sanity` at once (secret in `sync_config`), cron drains every
  10 min as fallback. Works publish only when `web_visible`; makers publish
  unless `web_visible` is switched off; inventory lists sync as `workList`
  docs only when `piece_lists.web_visible` ("List on website" switch on the
  list page), carrying web-visible members only; switching it off deletes
  the Sanity doc. Events may reference lists through `workLists`. A maker's
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
  flat / object, the "Website square" select on the piece form) is the
  owner's choice; on auto the sync reads the first photograph
  (`apps/studio/src/lib/squares`): a flat work cropped to its edges is
  fitted whole on white by the site; an object on the studio backdrop gets a
  rendered 1600 px square (centred on and sized by the object's body
  alone: the extent of its sharp edges, which a soft cast shadow or the
  backdrop's own lighting never has, falling back to clear colour
  difference when a piece shows too few edges; the body's larger side 86% of the tile, margins
  6.5% top and sides, 7.5% bottom, a wide low object set lower; shadows
  take what room the margins leave; backdrop and any shadow running off
  the frame continued with the photograph's own grain) kept
  in `piece-derivatives` as `<piece>/<image>.sq-<w>x<h>.jpg` and published
  as `tile`. `piece_image_squares` remembers the guess and the render per
  master size, so nothing is redone until the master changes. The fold-out
  panel and the full-screen view always show the whole photograph; full
  screen swaps in the largest rendition (up to 4096 px, the image worker's
  display-master cap since 9 October 2026).
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

## Money / VAT

Purchase £ is entered by hand; only the sale £ auto-converts from the spot rate
on the sale date. VAT-due display: margin scheme = 1/6 of (sale − total cost);
standard = 1/6 of sale; zero-rated / outside-scope = 0. Net = sale − VAT.
