# JVB — Asian Art Dealer System

Inventory database · CRM · Website, built for a UK Asian-art dealer replacing a legacy
FileMaker system. The full plan (architecture, schema, phasing, compliance) lives in
[`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md).

## Layout

| Path | What it is |
| --- | --- |
| `apps/studio` | Staff back office (Next.js) — inventory, Piece Detail, CRM, offers, stock book |
| `apps/web` | Public website (Next.js + Sanity) — works, collections, offers (`/o/[token]`), booking |
| `packages/db` | Supabase clients + domain types |
| `packages/ui` | Design tokens (oklch, from the design handoff) |
| `packages/emails` | React Email templates (offers, newsletters) |
| `packages/documents` | PDF generators (fact sheets, Avery mailing labels) |
| `supabase` | Database migrations (schema, RLS, views, seeds) |
| `infra` | VPS: docker-compose (self-hosted Supabase), Caddy, image worker, backups, runbook |
| `tooling/migration` | FileMaker import CLI (staged, auditable) |

## Getting started

```sh
corepack enable && pnpm install
supabase start                      # local Supabase (Docker) + applies migrations
cp apps/studio/.env.example apps/studio/.env.local   # fill in keys from `supabase status`
pnpm dev                            # studio on :3000, web on :3001
```

Create the first admin (invite-only auth — no public signup):

```sh
# in supabase studio (local) or psql: create the user, then
insert into user_roles (user_id, role) values ('<auth user id>', 'admin');
```

## Roles

- **admin** — everything
- **staff** — inventory + CRM + offers; cannot see purchase costs, margins, or invoices
- **accountant** — read-only inventory + financials + margin-scheme stock book; no CRM

## Production

The VPS runs only Supabase (`infra/compose`); both Next.js apps deploy to Vercel.
See `infra/README.md` for the provisioning runbook, backups, and disaster recovery.

## FileMaker migration

See `tooling/migration/README.md` — staged: parse → mapping review (dealer signs off)
→ clean → load → finalize → image matching → report. Real data stays out of git.
