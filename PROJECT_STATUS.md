# Project status & handoff

Working notes for continuity across Claude Code sessions. No secrets here — env
vars are referenced by name only.

## Deployment topology (source of truth)
- **Deploy repo:** `joostvandenberghproject-gif/jvb-project2026` — this is the
  source of truth. Both Vercel projects (`jvb-studio`, `jvb-web`) deploy from it
  (production branch `main`). Work here going forward.
- Earlier work was pushed to `BarthaContemporary/art-gallery-navigator` (a
  Claude Code agent remote) and periodically synced into the deploy repo. That
  split is being retired — everything now lives in `jvb-project2026`.
- **Studio DB is self-hosted Supabase on a Vultr VPS** (IP `104.238.184.145`).
  Reachable via `sslip.io` hostnames, e.g. `https://api.104-238-184-145.sslip.io`.
  The domain `joostvandenbergh.com` (GoDaddy DNS) still points at Squarespace;
  the `api.`/`studio.` subdomains have no DNS records (sslip.io is used instead).
- Applying DB migrations remotely: POST SQL to `/pg/query` (postgres-meta,
  exposed through Kong) with the `service_role` key as `apikey` + Bearer. This
  is how migrations 16/17 and the data backfill were applied.

## Server disk (2026-09-16)

- `/` (240 GB) was at 94% because the WebDAV drive's `Dropbox/` folder holds a
  192 GB archive copied from the old Dropbox; the photographs live in object
  storage and are not the cause. 28 GB of half-downloaded films (`*.part`)
  were deleted on the server (delete on the server, never from a synced Mac —
  a Mac-side delete lands in Syncthing's 365-day version store instead).
  Now ~82%. Still open: personal films under `Dropbox/transfer desktop`, and
  moving cold `fairs`/`images` years to a versioned `jvb-archive` bucket with
  `rclone move` (commands in the session notes). Reboot pending for kernel
  updates — check the gocryptfs mount and `docker compose ps` afterwards.
- Weekly object-storage replica timer installed and first run verified.

## Done
- Imported catalogue entries linked to artists (8 October): of 1,224 entries,
  355 were linked in one pass (artist names that sat in the title field,
  solo-show works with no maker written, named makers missing from the
  inventory), 130 makers created in the inventory with a note naming their
  exhibitions, 24 entries left for a decision. Report with every list:
  `docs/catalogue-artist-links-2026-10-08.md`. Artist pages show those
  entries under "Works from past exhibitions".
- Artist pages rebuilt and open again (`ARTISTS_UNDER_CONSTRUCTION` false): every
  portrait is black and white on the CDN and framed on the face. The
  studio detects the face (vendored pico cascade, `lib/face`) when a
  portrait is processed; `makers.portrait_focus` (0084) carries it and the
  sync writes the Sanity hotspot, detecting older portraits on their next
  pass. Without a portrait a detail of a work stands in, in colour; without
  any picture, the initial on the field. Index groups A to Z with a letter
  row; the artist page sets the square beside name, facts, biography, and
  dates the exhibitions and publications.
- Events can show whole inventory lists: lists sync to Sanity as `workList`
  documents (outbox + 0081–0083 triggers; re-pushed on list/membership/
  visibility changes) once "List on website" is switched on for the list;
  members are weak references, so works can still be unpublished. Events
  dedupe works across manual picks and lists and keep one order
  (`workOrder`, "Collect works" button); the fields need the next Studio
  deploy to appear. Event banners now use only uploaded slides.
- `ARTISTS_UNDER_CONSTRUCTION` in `apps/web/src/lib/site.ts` can lock the
  artist section again in one go (overlay, nav disabled, links plain, out of
  search/sitemap/llms, noindex); it is off since 8 October. Event
  banners are slow slideshows of the event's pictures; catalogue links prefer
  the publication page. Inventory lists can be put on / taken off the website
  in one click. Catalogue entries in Sanity are linked to inventory artists
  (`apps/web/scripts/match-catalogue-artists.mjs`, re-runnable; 56 names had
  no inventory maker and stay unlinked until a maker is created).
- Data-protection pass (Oct 2026): security headers on both apps; double
  opt-in newsletter with consent evidence; complaint/bounce suppression;
  subject-access export + erasure with legal holds on the contact page;
  Admin → Data protection (retention schedule enforced nightly, request and
  breach registers, review queues); Privacy Notice, Terms, Accessibility and
  footer trading disclosures (fill Site settings → legal fields, needs a
  Studio deploy for the new fields); compliance pack in `docs/compliance`.
  Owner actions in `docs/compliance/OWNER_CHECKLIST.md` — notably 181
  emailable contacts without an evidenced marketing basis.
- Website sync is now immediate: an outbox insert fires a pg_net POST to the
  studio's `/api/sync/sanity` (migration 0074; secret lives in `sync_config`,
  no env change needed), bursts collapse into one call, rows are claimed with
  SKIP LOCKED, and the 10-minute cron remains the fallback. Every maker has an
  artist page unless switched off (0075; switch in the makers list and on the
  profile page); a work appears only when "On website — yes" in its editor.
- All 17 migrations applied to prod (incl. `…16_newsletter_designer`,
  `…17_sanity_sync_state`); bootstrap ledger reconciled.
- Data backfill from the FileMaker import: **locations** (271 pieces + history),
  **categories** (390), sold-status verified (261). Nothing was lost — all
  1,087 pieces + raw rows intact.
- Features shipped: newsletter designer (+ Resend send, tracking webhook),
  appointments management, self-hosted Plausible (infra + studio results page),
  inventory resizable columns + location-name display, AI cataloguer default →
  Claude Sonnet 5, "Add to list" on piece pages + dynamic saved-view lists.
- Studio nav moved beneath the wordmark.

## Outstanding — configuration (on jvb Vercel projects unless noted)
- **Google Maps** (studio): set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (BUILD-time
  var — must be set before the build). In Google Cloud enable **Maps JavaScript
  API**, **Places API (New)**, **Maps Static API**; billing on; add the studio
  domain to the key's HTTP-referrer allowlist. Address form now surfaces the
  exact missing piece.
- **AI cataloguer**: `ANTHROPIC_API_KEY` (separate Claude account). Runtime var —
  needs a redeploy to take effect. Then "Analyse image" works per piece.
- **Plausible** (public-site analytics + studio results): stand up the stack
  (`infra/compose/plausible/`, `setup.sh`); web project needs
  `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` + `_SRC`; studio project needs
  `PLAUSIBLE_STATS_HOST` / `PLAUSIBLE_API_KEY` / `PLAUSIBLE_SITE_ID`.
- **Resend event webhook** (optional tracking): set `RESEND_WEBHOOK_SECRET` on
  web; point a Resend webhook at `/api/resend-webhook?secret=…`.
- **Rotate the Supabase `service_role` key** — it was shared in chat during
  migration/backfill work.

## Outstanding — data / content
- ~697 pieces uncategorised, ~942 without a maker, ~816 without a location —
  the info isn't in the structured legacy fields. Use the AI cataloguer
  (review-and-accept) or manual entry to finish. A bulk "catalogue all" job
  could be built if wanted.
- Artwork image files: migration created image *stubs*; actual files still need
  matching from source folders and bulk upload.
- Legal pages (Terms / Privacy / Cookie / AML) drafted — need solicitor sign-off
  before public launch.

## Deferred phases
Semantic search (pgvector) + "Similar works"; hosted KYC provider (AML is
in-house: date field + fortnightly UK Sanctions cron); Stripe purchases;
collector accounts.
