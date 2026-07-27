# ADR-000: CEIS as a module of the existing JvB platform

**Date:** 2026-07-27 · **Status:** proposed (awaiting Checkpoint 0)
**Spec refs:** §2.5, §3.1, §3.2, §1.3

---

## Context

The CEIS spec is deliberately stack-neutral and written as though CEIS may be a
standalone system: §1.3 says it is "not an inventory system" and that where such a
system exists, CEIS "*references* its records; it never replaces them."

Discovery (`docs/STACK_ASSESSMENT.md`) found a mature, production platform that
already supplies 9 of 12 requirements outright: Postgres 15, two Next.js apps,
passkey staff auth with roles, Resend with a live webhook, Vercel cron plus systemd
timers, self-hosted Plausible, and the Anthropic SDK. It also already holds the
contacts (869), the works (1,088) and the sales history (58) CEIS needs.

The question is therefore not *what stack* but *how tightly CEIS should bind to the
one that exists*.

## Options considered

**A. Separate service + separate database, integrating over APIs.**
Truest to the spec's "references, never replaces" framing. But: a second database
to back up and restore, a second deploy target, a second auth story, and
cross-database joins for the single most common query in the system ("show me this
contact's events alongside the works they viewed"). Every §5.6 surface would need
network calls to render. Contact identity would exist in two places and drift.
Fails tie-breaker (1) *fewest new moving parts* badly, and Hard Rule 9 *prefer
boring*.

**B. Module inside the existing monorepo, sharing the database and auth.**
CEIS tables join the existing schema; domain logic lives in a new `packages/ceis`;
public endpoints go in `apps/web`; staff surfaces in `apps/studio`. One backup, one
auth, one deploy pipeline. Risk: CEIS logic could sprawl into the rest of the
codebase and the "ports and adapters" discipline of §3.1 could erode.

**C. Module now, extractable later.**
Option B, plus an enforced boundary: all domain logic in `packages/ceis` with **no
I/O and no Supabase import**, reaching the outside world only through the ports in
§3.2. Extraction to Option A later means rewriting adapters, not domain code.

## Decision

**Option C.**

CEIS is built as a module of the existing platform, with ports-and-adapters
discipline preserved so the spec's stack-neutrality survives as a *code property*
rather than as separate infrastructure.

Concretely:
- `packages/ceis/domain/` — scoring, decay, banding, flow evaluation, dedupe/merge, consent decisions. Pure functions. No imports from `@supabase/*`, no `fetch`, no `Date.now()` — the clock is injected (§3.2 Clock).
- `packages/ceis/ports/` — the §3.2 interfaces, in TypeScript.
- `apps/studio/src/lib/ceis/adapters/` — concrete adapters (Supabase, Resend, Anthropic, pieces catalogue).
- Public ingestion endpoints in `apps/web/src/app/api/` — they must be same-site with the tracked domain (R3).
- Staff surfaces as routes in `apps/studio` behind existing auth.
- Migrations in `supabase/migrations/`, `ceis_`-prefixed tables, following the existing snake_case + RLS conventions, each ending `notify pgrst, 'reload schema';` per house rule.

This is an explicit, recorded deviation from the spec's implied separation
(§1.3). The spec's *intent* — that CEIS must not replace or corrupt the inventory
system of record — is preserved by rule: **CEIS never writes to `pieces`,
`piece_financials`, `kyc_*`, or any inventory table. It reads them.**

## Port → adapter mapping

| Port (§3.2) | Adapter | Backing | Verdict |
|---|---|---|---|
| `ContactStore` | `SupabaseContactStore` | `crm_contacts` (root) + new `ceis_contact_channel` | EXTEND |
| `EventStore` | `SupabaseEventStore` | new `ceis_event`, append-only, `dedupe_key` unique | BUILD |
| `EmailSignalSource` | `ResendWebhookSource` | hardened `/api/resend-webhook` → projector into spine | EXTEND |
| `TrackingCollector` | `CollectEndpoint` | new `POST /collect` in `apps/web` | BUILD |
| `IdentityResolver` | `SupabaseIdentityResolver` | new `ceis_visitor`, `ceis_identity_binding`; `/r/{token}` modelled on the proven `offer_recipients` token pattern | BUILD |
| `ScoreEngine` | pure domain + `ceis_score` table | Appendix C config, versioned | BUILD |
| `SegmentEngine` | pure domain | reuses `crm_lists` where natural | BUILD |
| `FlowEngine` | pure domain, hourly Vercel cron | Appendix E grammar only | BUILD |
| `ActionOutbox` | `SupabaseOutbox` | new `ceis_outbox_action`. **No Resend draft API** → `draft_email` renders copy-ready text/`.eml` | BUILD |
| `Notifier` | `ResendStaffNotifier` | existing Resend + staff addresses | REUSE |
| `ObjectCatalog` | `PiecesCatalog` | `pieces` + `/works/[slug]` + `sanity_sync_state`; **read-only** | REUSE |
| `ConsentService` | `SupabaseConsent` | new append-only `ceis_consent`, seeded from `crm_contacts.marketing_consent/consent_date/consent_source` | EXTEND |
| `Clock` / `Scheduler` | injected clock; Vercel cron + VPS systemd timers | existing | REUSE |

## Consequences

**Easier:** one database, one backup and restore path (already proven and now on
systemd timers), one auth, one design system. Contact identity cannot drift.
Backfill from 58 sales and 869 contacts is a local query, not an integration.
Briefs (§5.6.4) work on day one because the Anthropic SDK is already wired.

**Harder:** the boundary is a discipline, not a wall — a lint rule forbidding
`@supabase/*` imports inside `packages/ceis/domain/` should enforce it in CI.
CEIS migrations now share a numbering sequence with inventory migrations, so
migration hygiene matters more. Erasure (§5.8.4) must cascade across CEIS *and*
pre-existing CRM tables, which is more work than a standalone CEIS would face.

**What becomes riskier:** a bad CEIS migration can affect the production inventory
database. Mitigation: every migration reversible (Hard Rule 11), applied only after
a verified backup, and the restore drill — still outstanding — should be completed
before Phase 1 writes any schema.

**Exit path if reversed:** move `packages/ceis` to its own repo, reimplement the
adapters against a separate database, and replace direct `pieces` reads with an
API client. Domain logic, tests and config transfer unchanged. This is the whole
reason for Option C over Option B.
