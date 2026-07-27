# Stack Assessment — CEIS on the JvB platform

**Date:** 2026-07-27 · **Spec:** BUILD SPEC — Collector Engagement & Insight System, Phase 0 (§2)
**Status:** Draft for Checkpoint 0. No build code written. Read-only discovery + this document.

---

## 1. Environment summary

A pnpm/Turborepo monorepo already in production for Joost van den Bergh (UK dealer,
Japanese/Indian art).

| Piece | What | Evidence |
|---|---|---|
| `apps/studio` | Next.js 15 back-office on Vercel, `studio.joostvandenbergh.com` | `apps/studio/`, live HTTP 200 |
| `apps/web` | Next.js 15 public site on Vercel, Sanity for editorial | `apps/web/`, `apps/web/src/app/api/*` |
| `apps/capture` | Photo-capture companion app | `apps/capture/` |
| Database | PostgreSQL 15, self-hosted Supabase, Vultr London | `infra/compose/`, `supabase/migrations/` (54 migrations) |
| API | `https://api.104-238-184-145.sslip.io` (Kong → PostgREST/GoTrue/Storage) | `infra/compose/` |
| Jobs | Vercel cron (3) + systemd timers on the VPS (2) | `apps/studio/vercel.json`, `infra/systemd/` |
| Email | Resend, composed in-app | `packages/emails/`, `apps/web/src/app/api/resend-webhook/` |
| Analytics | Self-hosted Plausible, cookieless | `apps/web/src/components/plausible.tsx` |
| LLM | Anthropic SDK, already used for maker bios + cataloguing | `apps/studio/src/app/api/makers/[id]/ai-draft/` |

**65 tables** in `public`. The schema already anticipates much of CEIS — but the
engagement tables are essentially **empty**, which is the central finding of this
assessment (§3).

---

## 2. Requirement mapping (R1–R12)

| Req | Requirement | Found (evidence) | Fit | Verdict | Proposal | New deps | Effort |
|---|---|---|---|---|---|---|---|
| R1 | Relational store, transactional | Postgres 15 self-hosted Supabase; 65 tables; migration convention `supabase/migrations/NNNN_*.sql`; snake_case; RLS in active use | full | **REUSE** | CEIS tables join the same schema + migration convention | none | S |
| R2 | Scheduled jobs | Vercel cron: `/api/sync/sanity` 10-min, sanctions-screen, purge-deleted-pieces. Plus systemd timers on VPS | full | **REUSE** | Add CEIS jobs as Vercel cron routes; heavy/nightly work can go to a systemd timer | none | S |
| R3 | HTTP endpoints on a first-party origin of the tracked site | `apps/web` has live API routes (`/api/booking`, `/api/unsubscribe/[token]`, `/api/offer/*`) on the public domain | full | **REUSE** | `/collect` and `/r/{token}` become routes in `apps/web` — genuinely same-site | none | S |
| R4 | Site-wide JS snippet | `apps/web/src/app/layout.tsx` already injects a script via `next/script` | full | **REUSE** | Same injection point, consent-gated | none | S |
| R5 | Email signal source | **Resend**, with a live webhook at `apps/web/src/app/api/resend-webhook/route.ts` handling `delivered/opened/clicked/bounced/complained` → `email_events` + `crm_campaign_recipients` | partial | **EXTEND** | Two gaps: (a) auth is a `?secret=` query param, not Resend's Svix signature — see §7 R-1; (b) events don't reach a spine. Emails are composed **by us**, so first-party link-wrapping (§5.4.1) is fully feasible | none | M |
| R6 | Internal admin surface | `apps/studio` — full back-office, design system, `packages/ui` | full | **REUSE** | Hotlist/profile/outbox become studio routes | none | M |
| R7 | Staff auth | Supabase GoTrue + **passkeys**; `user_roles` with `admin/staff/accountant`; `hasRole()` helper; middleware | full | **REUSE** | Never build parallel auth. Role-gate merge/erase/flow-enable to `admin` | none | S |
| R8 | Secrets | Vercel env vars; `/etc/jvb/*.env` on the VPS; `safeEqual` helper for constant-time compare | full | **REUSE** | — | none | S |
| R9 | Consent mechanism on public site | **None.** `/cookies` and `/privacy` pages exist as copy. Plausible loads unconditionally — defensible today *only because it is cookieless* (no terminal storage → PECR s.6 not engaged) | none | **BUILD** | CEIS's `vid` requires first-party storage → consent is mandatory. Minimal banner per §5.8.3. **This is the single largest genuinely-new piece of work** | none | M |
| R10 | Contact & sales data to import | `crm_contacts` **869**; `pieces` **1,088** live; `piece_financials` with **58 sold**; `legacy_filemaker_rows` (raw migration snapshot); `activity_log` 8,161 | full | **REUSE** | Backfill gives scoring real history from day one (§5.1.4) | none | M |
| R11 | LLM API for briefs | `@anthropic-ai/sdk` in `apps/studio`, already used in production for maker biographies and AI cataloguing | full | **REUSE** | Pre-event briefs (§5.6.4) are available, not deferred | none | S |
| R12 | Appointment / calendar data | `appointments`, `appointment_types`, `availability_rules` tables exist — **0 rows**; booking route live at `apps/web/api/booking` | partial | **DEFER** | Schema is ready; signal starts flowing when bookings are used. No work needed now | none | — |

**Score: 9 REUSE · 2 EXTEND · 1 BUILD · 1 DEFER · 0 ADD.**
No new paid services, no new runtime dependencies. Success criterion §1.4.8 is met by construction.

---

## 3. Central finding: the schema exists, the signal does not

| Table | Rows | Reading |
|---|---:|---|
| `crm_contacts` | 869 | Real, imported |
| `pieces` (live) | 1,088 | Real |
| `piece_financials` (sold) | 58 | Real sales history — usable backfill |
| `activity_log` | 8,161 | Real (internal edits, not engagement) |
| `crm_interactions` | **0** | Table exists, never used |
| `crm_campaign_recipients` | **0** | — |
| `email_events` | **6** | Webhook fired a handful of times |
| `offer_recipients` / `offer_views` | 1 / 1 | One test offer |
| `piece_watches` | **0** | Feature shipped but **surfaced nowhere** (see §7 R-3) |
| `appointments`, `exhibitions` | 0 | Unused |

The platform has excellent *bones* for engagement and **almost no engagement data**.
CEIS is therefore not a rewrite — it is the layer that makes existing plumbing
actually produce and use signal. The scoring engine would otherwise have nothing
to rank, which is why the §5.1.4 backfill (58 sales + 869 contacts + any guest
lists) matters more here than the spec's default framing suggests.

---

## 4. Overlap with the CEIS data model

| CEIS entity (§4) | Existing | Verdict |
|---|---|---|
| `contact` | `crm_contacts` (869) | **REUSE as root.** Do not create a second contact table |
| `contact_channel` | `crm_contacts.email` / `.phone` — single-valued, inline | **EXTEND** — add the table; couples and shared inboxes are explicitly common in this domain (§5.1.3) |
| `consent` (append-only ledger) | Flat fields: `marketing_consent`, `consent_date`, `consent_source`, `do_not_mail`, `unsubscribed_at` | **EXTEND** — add the ledger; migrate current flat state in as the opening rows |
| `event` (the spine) | `crm_interactions` is `(contact_id, user_id, kind, note, happened_at)` — a **human-notes table**, no `dedupe_key`, `object_ref`, `visitor_id`, `quality`, or `occurred_at`/`received_at` split | **BUILD** the spine. Fold existing `crm_interactions` rows in later as `manual_note` |
| raw email signals | `email_events (provider, event_type, payload, campaign_recipient_id, offer_recipient_id)` | **REUSE as the landing zone**; add a projector into the spine |
| `occasion` | `exhibitions` (0 rows) | **REUSE** |
| `suppression` | `do_not_mail`, `unsubscribed_at`, `unsubscribe_tokens` | **EXTEND** into the scoped model |
| `object` / ObjectCatalog | `pieces` + `/works/[slug]` on the public site + `sanity_sync_state` | **REUSE** — URL→work resolution is already a solved problem here |
| click-token redirect (§5.4.1) | **`offer_recipients` already does exactly this**: unique `token`, per-contact, `first_viewed_at`, `view_count`, live at `/o/[token]` | **REUSE the pattern** — proven in production, not speculative |
| `audit_log` | `activity_log` (8,161 rows, trigger-populated) | **REUSE** |
| Hotlist / profile / outbox UI | `apps/studio` + `packages/ui` | **REUSE** |

---

## 5. Email platform capabilities (Resend)

| Capability | Status |
|---|---|
| Webhooks | **Yes**, live — but authenticated by shared secret in the query string, not Svix signature (§7 R-1) |
| Event types available | delivered, opened, clicked, bounced, complained |
| Per-recipient click data | Yes (`resend_email_id` stored on `offer_recipients` / `crm_campaign_recipients`) |
| Link wrapping | **Feasible** — we compose the HTML ourselves in `packages/emails`, so `/r/{token}` wrapping needs no platform feature |
| Draft API | **No** — Resend is send-only. `draft_email` actions (§5.7.3) must therefore render copy-ready text/`.eml` for the operator to send by hand |
| Unsubscribe | Own implementation: `unsubscribe_tokens` + `/api/unsubscribe/[token]` |
| Sandbox | Resend test mode available |

**Consequence for §5.7.3:** the "create a draft in the sending platform" adapter is
not available. This *strengthens* Hard Rule 1 (nothing sends) rather than weakening
it — the outbox terminates in copy-ready text plus an internal task, which cannot
send by accident. Recommend accepting this and documenting it, not switching ESP.

---

## 6. Compliance context

- **Jurisdiction:** UK business, EU/international collectors. **UK GDPR + PECR apply.** Spec §5.8 is applicable in full; no relaxations proposed.
- **Existing notices:** `/privacy` and `/cookies` pages exist on the public site. Content should be reviewed against what CEIS actually does before Phase 3 ships.
- **Existing consent state:** `crm_contacts` carries `marketing_consent`, `consent_date`, `consent_source` — so a basis was recorded at import. Whether it is *evidenced* per contact is an open question (Q10).
- **No CMP.** Today's Plausible is cookieless, so no consent gate is required for it. The moment CEIS stores a `vid`, that changes. The banner is a hard prerequisite for Phase 3, not a nice-to-have.
- **AML/KYC already present** (`kyc_profiles`, `kyc_checks`, `kyc_documents`) and explicitly out of CEIS scope (§1.3) — CEIS must reference, never touch.
- **`price_band` (§5.8.6):** no such field exists today. If added, human-entered only, admin-role-gated, never inferred.

---

## 7. Conflicts, risks, unknowns

**R-1 · Webhook auth is weaker than the spec requires.** `resend-webhook` compares a
`?secret=` query parameter. It fails closed and uses constant-time compare — good —
but secrets in URLs leak through proxy logs, browser history and `Referer`. Spec
§5.2.1 requires signature verification. *Proposal:* switch to Resend's Svix
signature headers, keep the shared secret as a transitional fallback, remove it
after cutover. Small, and it is a security improvement to code already in
production regardless of CEIS.

**R-2 · CEIS is specified as a system that *references* inventory (§1.3); here it
would live inside it.** That is the correct call for this environment — one
database, one auth, one back-office — but it is a real deviation from the spec's
framing and needs an explicit decision (ADR-000). The mitigation is module
boundaries in code, not separate infrastructure.

**R-3 · `piece_watches` is a working, unused signal.** The Watch star writes rows,
but nothing anywhere reads them — no filter, no view. It is a free, high-intent
affinity signal that should feed the spine as a `watch_added` event. Cheap win.

**R-4 · Scoring has little live signal to work with on day one.** With engagement
tables empty, a Hotlist built today would rank almost entirely on backfilled
purchases. Phase 4's calibration session (~20 known contacts) will be weak until
Phases 2–3 have run for some weeks. *Proposal:* keep the phase order, but set the
operator's expectation that the Hotlist earns its keep at ~4–6 weeks of live signal,
not at Phase 4 sign-off.

**R-5 · Two Next.js apps, one snippet.** Tracking belongs on `apps/web` only.
`apps/studio` is staff-facing and must never be tracked — staff browsing would
otherwise pollute engagement scores. Enforce by origin allowlist on `/collect`.

**R-6 · Sanity-hosted content.** Some public pages are Sanity-driven. URL→work
resolution should go through `pieces` + `sanity_sync_state`, not by scraping the
rendered page.

**Unknowns:** see `docs/OPEN_QUESTIONS.md`.

---

## 8. Recommended architecture (one paragraph)

CEIS becomes a **module inside the existing monorepo**, not a new service. Its
tables join the existing Postgres schema under the same migration convention, with
`crm_contacts` as the contact root and a new append-only `ceis_event` spine.
Ingestion runs through two public routes added to `apps/web` (`/collect`,
`/r/{token}`) plus a hardened Resend webhook; scheduled work runs as Vercel cron
routes, with nightly recompute on a VPS systemd timer if it outgrows the Vercel
window. Domain logic (scoring, resolution, flows, consent) lives in a new
`packages/ceis` with no I/O, written against ports; adapters bind those ports to
Supabase, Resend, Plausible, the Anthropic SDK and the `pieces` catalogue. All
staff surfaces are new routes in `apps/studio` behind existing passkey auth and
`user_roles`. Zero new services, zero new paid tiers. Full port→adapter mapping in
`docs/adr/ADR-000-architecture.md`.

---

## 9. Adjusted phase plan

The spec's 8 phases hold, with these environment-specific changes:

| Phase | Adjustment for this environment |
|---|---|
| **0** | This document + ADR-000 + open questions. **← we are here** |
| **1** | Lighter than spec: `crm_contacts` is already imported and deduped. Real work is the `ceis_event` spine, `contact_channel`, the consent ledger, and **backfill** of 58 sales + any guest lists as historical events |
| **2** | Mostly hardening: fix webhook auth (R-1), add the projector from `email_events` → spine, wire suppression to `unsubscribe_tokens`. Add `watch_added` (R-3) |
| **3** | **The heavy phase.** Consent banner (R9, the only true BUILD), `/collect`, snippet on `apps/web` only, `/r/{token}` link-wrapping in `packages/emails`, LIA. Privacy review gate |
| **4** | Scoring + Hotlist in `apps/studio`. Calibrate against 58 known purchasers. Expect thin live signal (R-4) |
| **5** | Occasions on `exhibitions`; briefs available immediately via the existing Anthropic SDK (R11 satisfied) |
| **6** | Flows + outbox. `draft_email` renders copy-ready text/`.eml` — no Resend draft API (§5) |
| **7** | Erasure/export must cascade across **both** CEIS and existing CRM tables. Extend the existing runbook rather than starting a new one |

**Sequencing note:** Phase 3 is the long pole and the only one with a hard external
dependency (a privacy-notice review). Everything before it is additive to systems
already running.

---

## 10. Questions requiring operator input

See `docs/OPEN_QUESTIONS.md` — 8 questions, each with a recommended default so
Checkpoint 0 can be approved by exception rather than by essay.
