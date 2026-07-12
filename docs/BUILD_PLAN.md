# Asian Art Dealer System — Build Plan
Inventory database · CRM · Website (Supabase self-hosted + Next.js + Sanity)

## Context

A UK Asian-art dealer (~1,087 stock records, Japanese/Indian works) is replacing a legacy FileMaker system. The FileMaker export shows severe data drift: 747/1,087 records lack stock numbers, 54 numbers are duplicated, `Category` mixes classification codes/regions/sale-status, maker names and dimensions live in free-text, and image containers reference filenames only. The provided design handoff (Piece Detail page, high fidelity, greyscale oklch + Hanken Grotesk/JetBrains Mono) sets the design language for the whole internal app.

The repo currently holds an unrelated Lovable-built gallery app. **Decision: fresh build, ignoring the existing app entirely** — the feature branch starts a clean monorepo at the repo root (the old app remains untouched on `main`); nothing from it is reused or referenced.

**Locked decisions** (from Q&A): year+sequence stock numbers (`2026-0001`); Resend for email; tokenized private links first, collector accounts later; internal app is Next.js on Vercel (VPS runs only Supabase); legacy images are partially/scattered — extraction step required; CRM contacts arrive via CSV; VAT is mixed per-item (margin scheme + standard), with an HMRC-compliant margin-scheme stock book for the accountant; exports must work with Proton (Mail/Sheets/Docs/Calendar) and as PDF; multiple typed attachments per piece (invoices, certificates, …) and location-history tracking; client onboarding with AML/KYC; all surfaces mobile-first; GDPR compliance with T&Cs/privacy/cookie policies; Stripe purchases for onboarded clients as a later phase.

## 1. Monorepo layout (pnpm + Turborepo)

```
apps/
  studio/                  # internal back-office — Next.js 15 App Router, Vercel
  web/                     # public website — Next.js + Sanity, Vercel
packages/
  db/                      # supabase-js clients, generated DB types, zod schemas
  ui/                      # design tokens (oklch → CSS vars), Tailwind preset, shared primitives
  emails/                  # react-email templates (offer, newsletter, fair preview, booking, auth)
  documents/               # PDF/DOCX generators (fact sheets, certificates, provenance, stock book, labels)
  config/                  # shared tsconfig/eslint
supabase/                  # Supabase CLI project: migrations/, seed.sql
infra/
  compose/                 # docker-compose.yml (self-hosted Supabase), Caddyfile, .env.example
  image-worker/            # Node + sharp derivative worker container
  scripts/                 # provision.sh, backup.sh, restore-drill.sh
tooling/migration/         # FileMaker import CLI (scan-images, import-raw, clean-*, finalize, report)
```

First commit: remove the existing app's files from this branch and scaffold the clean workspace (the old app lives on unaffected on `main`). CI: GitHub Actions (lint, typecheck, build); Vercel deploys `apps/studio` and `apps/web`.

## 2. VPS + self-hosted Supabase (Vultr, London)

- **Instance**: High Frequency 4 vCPU / 8 GB RAM / 256 GB NVMe (~$48/mo) + **Vultr Object Storage** (London) for image originals and backups.
- **Compose stack** (trimmed from supabase/docker): `db` (Postgres 15), `kong`, `auth` (GoTrue, SMTP via Resend), `rest` (PostgREST), `storage` (storage-api with **S3 backend → Vultr Object Storage**), `imgproxy` (on-the-fly image transforms), `meta`, `studio` (dashboard), plus our `image-worker`. **Omitted**: realtime, edge-function runtime, analytics — all server logic lives in Next.js route handlers/server actions on Vercel instead (self-hosted edge functions are the weakest part of self-hosting).
- **Proxy/TLS**: Caddy on host — `api.<domain>` → kong; `db-admin.<domain>` → Supabase dashboard behind basic-auth + IP allowlist (single shared login is a self-hosting limitation; dashboard is break-glass only, day-to-day admin happens in the studio app).
- **Security**: UFW (80/443 + keyed SSH only), fail2ban, Postgres never exposed publicly (SSH tunnel for admin), unattended-upgrades, secrets in server-side `.env` only.
- **Backups/DR**: nightly `pg_dump -Fc` → Object Storage (30 daily / 12 monthly), healthchecks.io ping; weekly `rclone sync` of the storage bucket to a second bucket; quarterly scripted restore drill; Uptime Kuma/Better Stack HTTP monitoring. Runbook in `infra/README.md`.
- **Webhooks without hosted infra**: outbox pattern — DB triggers write `sync_outbox`, `pg_net` POSTs to a Vercel endpoint immediately, a Vercel cron drains the outbox every 10 min as the reliable fallback.

## 3. Database schema (key tables)

**Enums**: `user_role(admin, staff, accountant)` · `piece_status(in_stock, reserved, consigned_in, consigned_out, sold, gifted, returned, written_off)` · `vat_treatment(margin_scheme, standard, zero_rated, outside_scope)` · `image_role(front, back, side, signature, box, detail, condition, document)` · `offer_kind(offer, fair_preview, viewing_room)`.

**Inventory**
- `makers` — display_name, native_name (CJK), romanized_name, alt_names[], life_dates, region, biography; pg_trgm search.
- `categories` — hierarchical (code, name, parent_id: e.g. Japan → Metalwork).
- `locations` — code (`SJ-B2`), name, type (gallery/storage/fair/restorer/consignee/auction).
- `pieces` — **stock_number unique (trigger-assigned `YYYY-NNNN`)**, **legacy_stock_number (nullable, non-unique) + legacy_stock_number_conflict flag**, title, maker_id, attribution_qualifier, category_id, medium, period, origin_region, description, condition_report, signature_inscription, box_type/box_notes (tomobako), height/width/depth/length/diameter_cm, weight_g, dimensions_display (verbatim legacy fallback), status, location_id, photographer, comments, web_visible, audit columns.
- `piece_financials` — **separate 1:1 table so financial RLS is row-level, not column hacks**: purchase date/cost/currency/fx/GBP, purchase_invoice_ref, seller_contact_id, restoration/other costs, marked_price, sold date/price/currency/fx/GBP, sale_invoice_ref, buyer_contact_id, **vat_treatment**, generated total_cost_gbp / margin_gbp / margin_pct, consignment_id.
- **Stock numbering**: `stock_number_counters(year, last_seq)` + `next_stock_number()` with advisory lock; BEFORE INSERT trigger. Legacy numbers preserved verbatim, never reused.
- `piece_images` — role (maps to design captions Front/Side/Signature/Box/Detail), caption, sort_order, storage paths (original + display master), dims, exif jsonb, processing_status, legacy_container_filename.
- `provenance_entries` — date_text (fuzzy), party, event_type (acquired/collection/auction/exhibited/published), is_public — feeds the design's timeline.
- `piece_documents` — **multiple typed attachments per piece**: piece_id, doc_type enum (`purchase_invoice`, `sale_invoice`, `certificate`, `export_licence`, `condition_report`, `provenance_document`, `correspondence`, `shipping`, `insurance`, `other`), title, file storage_path (private `piece-documents` bucket, any file type: PDF/image/scan), issued_by, issued_date, notes, uploaded_by/at. `piece_financials.purchase_invoice_ref`/`sale_invoice_ref` link to the corresponding document rows. Documents panel on the Piece Detail page (upload, preview, download); RLS: invoices visible to admin/accountant only, other doc types to all staff.
- **Location tracking**: `pieces.location_id` holds the current location; `piece_location_history` (piece_id, from_location_id, to_location_id, moved_at, moved_by, reason/note) is appended automatically by trigger on every location change — full movement audit trail per piece (gallery ↔ storage ↔ fair ↔ restorer ↔ consignee), shown as a timeline on the Piece Detail page and filterable in the inventory list ("everything currently at the fair").
- `exhibitions` + `piece_exhibitions` · `consignments` (direction, counterparty, revenue_split_pct, terms) + `consignment_items` · `enquiries` · `piece_watches(user_id, piece_id)` (design's watch toggle) · `piece_lists`/`piece_list_items` (custom lists, static + jsonb filter rules = saved views) · `exchange_rates`.
- `activity_log` — trigger-populated old/new diff jsonb on pieces/financials/contacts — feeds the design's audit trail.

**Migration staging**: `legacy_filemaker_rows` (full raw row as jsonb, permanent audit, fk to created piece, issues[]) · `legacy_value_mappings` (field, raw_value, mapped_value, reviewed) — dealer-reviewed mapping of the Category/Status/Location/Published mess.

**CRM**: `crm_contacts` (names, salutation, email/phone, postal address, instagram/whatsapp/line/wechat, tags[], custom_fields jsonb, marketing_consent + date + source, do_not_mail, unsubscribed_at, contact_type: collector/museum/dealer/auction_house/shipper/restorer/press, interested_regions[]/categories[]) · `crm_organizations` · `crm_interactions` · `crm_lists` + members · `crm_campaigns` + `crm_campaign_recipients` (resend_email_id, opened/clicked/bounced) · `email_events` (raw Resend webhooks).

**Offers**: `offers` (kind, intro, show_prices, expires_at) · `offer_items` (piece, price_override, note) · `offer_recipients` (**unique token**, sent/viewed timestamps, view_count, response) · `offer_views`.

**AML/KYC** (UK art dealers are HMRC-supervised Art Market Participants; MLR 2017 CDD required for transactions ≥ €10k): `kyc_profiles` (contact_id, status: not_started/pending/verified/refer/rejected, risk_rating low/medium/high, verified_at, expires_at, provider_ref) · `kyc_checks` (profile_id, check_type: identity/pep/sanctions/adverse_media, provider, provider_check_id, result, raw_result jsonb, checked_at) · `kyc_documents` (typed ID/proof-of-address docs, encrypted-at-rest private bucket, strict admin-only RLS, retention policy) · sanctions re-screening on a schedule (`sanctions_status`/`last_screened_at` on contacts). **Provider**: identity verification + PEP/sanctions via a hosted-flow provider (recommend SumSub or ComplyAdvantage + Veriff; hosted flow keeps ID documents off our infrastructure where possible). Onboarding flow: dealer triggers from CRM → contact receives tokenized secure link → completes ID + address verification in the provider's hosted flow → webhook updates `kyc_profiles` → dealer reviews/approves. A sale to a contact above the threshold surfaces a KYC gate in the studio. All checks logged for the HMRC audit trail.

**Payments (future-proofed now, built in Phase 6)**: `orders` (contact_id, status, currency, totals, vat summary, stripe_payment_intent_id/checkout_session_id) · `order_items` (piece_id, agreed_price, vat_treatment snapshot) — schema and status flow (`reserved` on checkout start, `sold` on payment success, webhook-driven) created early so offers can later carry a "Purchase" action for **KYC-verified clients** via Stripe Checkout (single or multiple works, card + bank transfer rails), with automatic invoice document generation into `piece_documents`.

**Appointments** (website booking): `appointment_types` (private gallery viewing / fair meeting, duration, location), `availability_rules`, `appointments` (contact_id nullable→auto-create, type, start/end, status, notes, ics_uid).

**Sync/auth**: `sanity_sync_state` (entity, sanity_doc_id, last_pushed_hash, status) · `sync_outbox` · `profiles` + `user_roles` + `has_role()` SECURITY DEFINER helper used by all policies · `invitations`.

**RLS/roles**: deny `anon` everywhere. Admin: full. Staff: full inventory/CRM/offers but **no SELECT on `piece_financials`** (commercial band renders only for privileged roles). Accountant: read-only pieces + financials + stock-book views, no CRM. `vw_stock_book`: HMRC VAT Notice 718 margin-scheme stock book (stock no., purchase date/invoice/seller/price, description, sale date/invoice/price, margin, VAT due = 1/6 margin) + parallel view for standard-rated items. Accountant signs off the format before export work (Phase 1b gate).

## 4. Image pipeline

- Studio upload: browser → **resumable TUS upload** direct to private bucket `piece-originals` (signed by a studio route handler); `piece_images` row inserted with `processing_status='pending'`.
- `infra/image-worker` (Node + sharp, LISTEN/NOTIFY + 60s poll): EXIF/ICC extraction → jsonb, auto-rotate, convert (incl. TIFF) to **sRGB JPEG display master, max 2560px q85** → private `piece-derivatives` bucket.
- All other sizes (thumbs, list, detail) generated **on-the-fly by imgproxy from the display master** via storage-api `/render/image` signed URLs — one pre-generated derivative keeps the pipeline simple; originals never leave the private bucket; public-site traffic never hits the VPS (images are pushed to Sanity CDN, §7).

## 4b. Search & AI cataloguing assistant

**Full inventory indexing (Phase 1, in-database — no extra search service to operate):**
- `pieces.search_vector` — generated, weighted tsvector over stock number + legacy number (A), title + maker names incl. native/romanized/alt (A), category/medium/period/origin (B), description/signature/box notes (C), provenance/comments (D); GIN-indexed. Postgres FTS handles phrases, prefixes and boolean queries.
- `pg_trgm` GIN indexes on titles/maker names/stock numbers for fuzzy matching (typos, romanization variants: "Shomin"→"Shōmin").
- **Semantic search via `pgvector`** (ships with self-hosted Supabase): `piece_embeddings` (piece_id, text_embedding, image_embedding, model, updated_at). Text embeddings from the assembled catalogue text (Voyage AI or OpenAI embeddings API, pennies at this scale); image embeddings from open-source CLIP running inside `infra/image-worker` (no per-image API cost). Refreshed by trigger→outbox on edit.
- Studio search UX: one omnisearch bar (`⌘K`) blending exact stock-number hits, FTS, fuzzy and semantic results with facet chips (category, maker, period, region, status, location, price band, has-image, VAT treatment); the same engine powers custom-list filter rules and the public site's works search (web-visible subset only).

**Image analyser + hashtags (Phase 2b):** on image processing, a vision model (Claude API) analyses the image set and writes `ai_suggestions jsonb` on the piece: proposed **hashtags** (object type, material, technique, motif, style — e.g. `#okimono #bronze #shibuichi #dragon #meiji`), plus draft field values (category, medium, period estimate, description skeleton). Tags live in `tags`/`piece_tags` with `source: manual|ai` and are searchable/facetable. **Suggestions are always review-and-accept in the edit UI, never auto-applied** — accepted/rejected state is kept so the prompt improves over time.

**Matching-works knowledge base (Phase 2b):** nearest-neighbour search over the image + text embeddings of the dealer's own 1,087-record corpus (a genuine domain knowledge base after migration). Surfaces: a "Similar works" panel on Piece Detail (beyond same-maker); and during **new-object entry**, uploading the first photo immediately shows the closest existing works and offers their maker/period/category/medium as one-click prefill suggestions — new records inherit institutional knowledge instead of starting blank. Optionally enriched later with reference-literature entries added to the same embedding space.

## 5. FileMaker migration (staged, idempotent, auditable)

1. **Image scan**: dealer supplies scattered folders/drives; `scan-images.ts` builds a manifest (filename, path, sha256, dims).
2. **Raw load**: all 1,087 rows → `legacy_filemaker_rows.raw` jsonb (permanent snapshot).
3. **Mapping review**: generate spreadsheets of distinct values with proposed mappings — Category → {category, region, status}, Location → {storage location | origin region}, Published → buyer/export notes → comments/provenance. Dealer reviews in the spreadsheet; result imported to `legacy_value_mappings`.
4. **Cleaning passes** (each appends to `issues[]`): dimension parser over the 8 inconsistent columns + Description regex, with `dimensions_display` verbatim fallback; currency/FX → GBP; maker-name extraction from Description as **proposals the dealer confirms** — never silently applied; `Item` → box fields; `Manufacturer` → photographer/source note.
5. **Finalize**: insert pieces, financials (vat_treatment from `VAT Yes` + mapping, margin_scheme default with review flag), provenance, exhibitions, image stubs.
6. **Stock numbers**: every piece gets a new number — purchase-year series where a date exists (`2019-0007`, chronological stock book), `2026-` series otherwise; counters seeded above migrated maxima. The 54 duplicate legacy numbers stored verbatim with conflict flag + report. *(Open item: confirm purchase-year vs all-2026 with the dealer.)*
7. **Image matching**: manifest ↔ container filenames (exact → case/ext-insensitive → trigram fuzzy); ambiguities pick largest file + flag; migration report lists matched %, ambiguous, unmatched, orphans; matched files bulk-upload through the normal pipeline.
8. **Acceptance**: row-count + financial-sum reconciliation; dealer spot-checks 50 records in the studio; `/migration` review queue for flagged records.

## 6. Internal app (`apps/studio`)

Auth: GoTrue email+password, **invite-only**, `@supabase/ssr` middleware, roles from `user_roles`.

Routes: `/dashboard` · `/inventory` (filterable table/grid incl. filter-by-current-location, saved views = piece_lists, CSV export) · **`/inventory/[stockNumber]` — Piece Detail exactly per the design handoff, extended with a Documents panel (typed attachments) and a location-history timeline** (sticky blurred header with breadcrumb/record-position/prev-next/watch/edit; 640px gallery with hero + role-captioned thumbs; status pill with the single green dot; 3×3 spec grid; description/condition/signature; provenance timeline; commercial band — marked price, cost, margin %, days-in-stock, enquiries, consignment card with revenue split + VAT note — **rendered only for admin/accountant**; related works by maker; activity trail) · `/inventory/[stockNumber]/edit` + `/inventory/new` (auto stock number) · image manager · `/makers` · `/locations` · `/stock-book` (accountant: date-range margin-scheme report → CSV/PDF) · `/crm/*` (contacts, organizations, lists, campaigns) · `/offers` + composer · `/labels` · `/appointments` · `/settings` (users/invites, categories, locations, sync status) · `/migration` (Phase 1 only).

Design system in `packages/ui`: the handoff's oklch greyscale tokens as CSS variables in a Tailwind preset; `next/font` Hanken Grotesk + JetBrains Mono (mono for stock numbers/prices/dates); green reserved for the status dot.

**Mobile-first everywhere**: every surface (studio, website, offer pages, booking, KYC flow) is built responsive from the start — the handoff's 1320px Piece Detail is the desktop layout; it collapses to a single-column mobile layout (gallery swipe carousel, spec grid 3×3 → 2-column, sticky header condenses to back + stock number + actions menu); inventory table becomes a card list; touch targets ≥ 44px; image manager supports capture-from-camera on phones (photographing stock at fairs). Playwright viewport checks at 375/768/1320 in CI.

## 7. Website + Sanity (`apps/web`)

- **Sanity owns editorial** (pages, about, journal, exhibitions, navigation, SEO defaults, curated collections); **Supabase pushes read-only `work` docs**: trigger on web_visible pieces/images → `sync_outbox` → pg_net POST → studio route `/api/sync/sanity` (shared secret) → uploads display masters as Sanity assets (sha-deduped), `createOrReplace` with `_id: work-{uuid}`, skips when content hash unchanged; Vercel cron drains misses; unpublish deletes the doc. Public traffic served entirely from Sanity CDN + Vercel.
- Site: `/`, `/works`, `/works/[slug]`, `/collections/[slug]`, `/exhibitions`, `/journal`, `/about`, `/contact`, `/visit` (booking). ISR with tag revalidation; Sanity webhook → `/api/revalidate`.
- **SEO**: Metadata API, JSON-LD (`VisualArtwork`, `ArtGallery`, `BreadcrumbList`; `Offer` only if prices go public — likely POA), sitemap/robots route handlers, per-work OG images via `@vercel/og`.
- **AEO**: `llms.txt`; FAQ page with `FAQPage` JSON-LD (collecting bronzes, tomobako, shipping, provenance); works rendered as semantic definition lists so answer engines can lift maker/period/region/medium facts; glossary of domain terms.

## 8. Offers, client dashboard, appointment booking

- `apps/web` `/o/[token]` (noindex): validates `offer_recipients.token`, renders personalised offer/fair preview (greeting, works, prices if enabled, expiry, "I'm interested" → `enquiries` + staff notification); every view logged.
- Studio composer: pick works (list or ad hoc), recipients (contacts or CRM lists), price overrides, expiry → Resend batch send (`packages/emails/offer.tsx`), unique token per recipient. Tracking view merges Resend webhook events + page views: sent → opened → viewed → responded, per contact.
- Fair previews = `kind='fair_preview'` with fair metadata. Phase 5: collector magic-link accounts (contact ↔ auth user) — schema already supports it.
- **Booking** (`/visit`): appointment types (private gallery viewing; fair/exhibition meetings), availability rules, double-booking guard; confirmation email via Resend **with ICS attachment (works natively with Proton Calendar)** + staff notification; manage in studio `/appointments`.

## 9. Newsletters, labels, exports (Proton + PDF)

- **Newsletters**: recipients resolved from `crm_lists` minus unconsented/unsubscribed/bounced; per-recipient Resend batch send (list truth stays in our DB; `{{salutation}}` personalisation; per-recipient tracking); react-email templates; `List-Unsubscribe` + tokened unsubscribe page. UK GDPR: consent+date+source per contact, documented legitimate-interest default for imported existing clients, contact export + hard-delete, privacy notice.
- **Labels**: `/labels` — select list → Avery (L7160/62/63) PDF via `@react-pdf/renderer`, country-aware formatting, skips `do_not_mail`.
- **GDPR & legal (programme-wide)**: records-of-processing documentation; consent + date + source per contact; subject-access export (full contact data as PDF/CSV) and hard-delete/anonymise routines (with legal-hold exception for AML records, which MLR requires be kept 5 years); cookie consent on the website (analytics only after consent); data minimisation in Sanity (no personal data leaves Supabase except offer greetings); **Terms & Conditions, Privacy Policy, and Cookie Policy pages** drafted for both website and client-facing flows (offers, booking, KYC, later purchases) — we draft, dealer's solicitor reviews before go-live (flagged as a launch gate); DPAs collected for Vercel, Sanity, Resend, Stripe, KYC provider.
- **Exports for Proton** (`packages/documents`, export buttons throughout studio):
  - **Proton Mail**: offers exportable as a rendered email (.eml download + copy-ready HTML) so the dealer can send from a Proton address instead of Resend when preferred; contact/list export as vCard + CSV for Proton Mail contacts.
  - **Proton Sheets**: every list surface (inventory lists, custom piece lists, CRM lists, stock book) exports CSV **and XLSX**.
  - **Proton Docs**: per-work or multi-work **fact sheets, certificates of authenticity, and provenance documents** generated as **DOCX (editable in Proton Docs) and PDF** from templates (letterhead, images, spec grid, provenance timeline).
  - **Proton Calendar**: all appointments/fair events downloadable as ICS; booking confirmations carry ICS invites.
  - **PDF everywhere**: stock book, custom lists, labels, fact sheets, certificates, offers — all have PDF output.

## 10. Phasing (each phase ends with a joint review)

| Phase | Scope | Size | Review gate |
|---|---|---|---|
| 0 | Clean monorepo scaffold, VPS + compose + Caddy + backups + monitoring, CI, Vercel projects, auth end-to-end | ~1 wk | Login to empty studio; restore drill passes |
| 1 | Inventory schema + RLS, image pipeline, stock numbering, **full search indexing (FTS + fuzzy + semantic)**, inventory list + **Piece Detail per handoff** + edit, FileMaker staged migration + mapping spreadsheets + image matching | 3–4 wks | All 1,087 records browsable with images and searchable; dealer signs off mappings + migration report |
| 1b | Stock-book views + CSV/XLSX/PDF export | ~0.5 wk | Accountant validates margin-scheme format |
| 2 | CRM: contacts CSV import, orgs, lists, interactions, labels, document exports (fact sheets/certificates DOCX+PDF) | ~2 wks | Labels printed from a real list; sample certificate approved |
| 2b | AI cataloguing: image analyser → hashtag + field suggestions, similar-works panel, new-entry prefill from knowledge base | ~1 wk | Dealer reviews AI tags/suggestions on 20 known works; precision judged acceptable |
| 3 | Sanity schemas, sync service, public website, SEO/AEO | ~3 wks | Staging site with selected works; structured-data validation passes |
| 4 | Offers composer + tokenized pages, newsletters via Resend, tracking, .eml export, appointment booking + ICS; T&Cs/privacy/cookie pages live (solicitor-reviewed) | 2–3 wks | Test fair-preview mailing + test booking end-to-end; legal sign-off |
| 5 | **Client onboarding + AML/KYC**: provider integration (hosted ID + PEP/sanctions flow), KYC statuses in CRM, re-screening schedule, HMRC audit trail, KYC gate on sales | ~2 wks | Full test onboarding of a dummy client; compliance walkthrough with the dealer's MLRO/accountant |
| 6 | **Stripe purchases**: Checkout for single/multiple works from offers/website for KYC-verified clients, webhook-driven reserve→sold flow, automatic invoice generation | ~2 wks | Test purchase in Stripe test mode end-to-end incl. inventory status + invoice |
| 7 | Later: collector accounts, dynamic list rules, deals pipeline, realtime | — | — |

## 11. Risks & open decisions

**Risks**: image extraction depends on locating source folders (mitigated: manifest + unmatched report + repeatable rescan; accept some missing); dealer-time-bound data cleaning (schedule mapping review at Phase 1 *start*); self-hosted Supabase ops burden (mitigated: S3-backed storage, backups, restore drills, runbook; escape hatch to managed Postgres documented); Vercel/Sanity/Resend/Stripe/KYC provider are non-UK processors (DPAs + privacy notice); AML/KYC is a regulated area — the system provides tooling and audit trail, but the dealer's HMRC AMP registration, risk assessment and policies are their compliance responsibility (advise confirming with their accountant/advisor); legal documents need solicitor review before public launch.

**Open decisions for the dealer** (to settle during Phase 1): legacy renumbering series (purchase-year vs all-2026); whether staff may see costs/margins; public price display (POA vs listed); domain/DNS; who holds VPS root access; KYC provider selection (SumSub vs ComplyAdvantage+Veriff — pricing/UX comparison to be presented at Phase 5 start); Stripe account setup + which payment rails (cards only vs + Bacs/bank transfer).

## Reference material
- Design handoff: `design_handoff_piece_detail/` (uploaded zip) — pixel reference for the Piece Detail page and the design language of the whole studio app
- `FileMaker_complete_records.xlsx` (uploaded) — source data for migration; profiled in this plan
- The pre-existing app in the repo is **ignored entirely** — no code, schema or patterns are taken from it; it remains untouched on `main`

## Verification
- Phase 0: `docker compose up` on VPS; `curl https://api.<domain>/rest/v1/` authenticated; restore drill from backup.
- Phase 1: migration report reconciles row counts + financial sums vs FileMaker; browse all records in studio; search "Shomin bronze" (no macron) and confirm fuzzy+semantic hits; upload a 100MB TIFF and confirm derivative + imgproxy thumbs; create a piece → stock number `2026-0001` auto-assigned; attach a purchase invoice PDF + certificate to a piece and confirm invoice is hidden from staff role; move a piece between locations and confirm history timeline records both moves; accountant login sees stock book but no CRM; staff login sees no financials.
- Phase 3: Google Rich Results test on `/works/[slug]`; Lighthouse SEO ≥ 95.
- Phase 4: send test offer to internal addresses; confirm token page renders, view tracking increments, unsubscribe works; book a viewing and open the ICS in Proton Calendar.
- Phase 2b: run the analyser over 20 well-catalogued works and compare AI hashtags/fields against the dealer's own descriptions; photograph a new object and confirm similar-works prefill proposes the right maker/category.
- Mobile: Playwright runs at 375px viewport across studio + web critical flows; manual check of Piece Detail, offer page and booking on a real phone.
- Phase 5: dummy-client KYC onboarding completes via provider sandbox; sanctions re-screen fires on schedule; sale above threshold blocks until KYC verified.
- Phase 6: Stripe test-mode purchase of two works → pieces flip reserved→sold, invoice PDF lands in piece_documents, order visible in studio.
