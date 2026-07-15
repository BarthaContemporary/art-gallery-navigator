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

## Done
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
