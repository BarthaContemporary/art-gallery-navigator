# Supabase database project

Schema, RLS, and reference data for the dealer system (see
`docs/BUILD_PLAN.md` §3–4b). Everything lives in ordered migrations under
`migrations/` — `supabase db reset` must always run clean from scratch.

## Layout

```
supabase/
  config.toml                  # local dev config (supabase start)
  migrations/                  # ordered, timestamped SQL migrations
    20260713000001_extensions.sql
    ...
    20260713000013_seed_reference_data.sql
```

Reference data (categories, locations, appointment types) is a **migration**
(0013), not `seed.sql`, because it is required in production too. There is no
`seed.sql`; fake data is never seeded — real stock arrives via
`tooling/migration` (FileMaker import).

## Local development

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and Docker.

```sh
# start the local stack (Postgres :54322, API :54321, Studio :54323)
supabase start

# apply all migrations to a fresh database (destroys local data)
supabase db reset

# create a new migration
supabase migration new my_change_name
```

Notes:

- Signup is disabled (invite-only). Create local users in Studio
  (http://localhost:54323) or via the Admin API, then grant a role:
  ```sql
  insert into user_roles (user_id, role) values ('<auth-user-uuid>', 'admin');
  ```
- `pg_net` may be unavailable locally — migration 0001 skips it gracefully
  (only the outbox HTTP push is affected; the cron drain path still works).
- All storage buckets are private; bucket + policy creation is skipped
  automatically if the storage schema is absent (bare Postgres).

## Applying migrations to the VPS (self-hosted Supabase)

Postgres on the VPS is **never** exposed publicly — connect through an SSH
tunnel, and apply migrations with `scripts/apply-migrations.sh`
(`docs/ops/security-runbook.md` step 5.4 has the full procedure):

```sh
# window 1: open a tunnel: local 54322 -> VPS-internal Postgres 5432
ssh -N -L 54322:127.0.0.1:5432 root@<vps-host>

# window 2: list, then apply, in number order; each file is one transaction
CHECK=1 scripts/apply-migrations.sh 0097
scripts/apply-migrations.sh 0097
```

It connects as `supabase_admin`, the user every earlier migration ran as, so
new objects have the same owner. Run `pnpm test:db` first, and take a backup
(or check the nightly `pg_dump` succeeded) before applying to production;
`infra/scripts/` holds the backup/restore tooling.

Never run `supabase db push` against the VPS: the live database was built
without the CLI's `supabase_migrations` history, so a push would try to apply
every migration again from the first one.

## Regenerating TypeScript types

Generated types live in `packages/db` and must be regenerated after any
schema change:

```sh
# from the local stack
supabase gen types typescript --local > packages/db/src/types/database.ts

# or from the VPS through the tunnel
supabase gen types typescript \
  --db-url "postgresql://supabase_admin:<password>@localhost:54322/postgres" \
  > packages/db/src/types/database.ts
```

## Schema conventions

- Financials are a separate 1:1 table (`piece_financials`) so RLS can hide
  them from the `staff` role entirely; staff have **no** policy on it.
- All views are `security_invoker = true` — the querying user's RLS applies.
- Every RLS policy goes through `has_role()` / `has_any_role()`
  (SECURITY DEFINER, `search_path = public`).
- Trigger functions that write to restricted tables (activity log, financials
  auto-create, location history, stock counters, sync outbox) are
  SECURITY DEFINER so staff actions still work.
- Stock numbers (`YYYY-NNNN`) are assigned by a BEFORE INSERT trigger using
  per-year counters + a transaction-scoped advisory lock; pass an explicit
  `stock_number` (migration tooling) to bypass assignment.
- `anon` has no policies and no table grants: all public/tokenized surfaces
  (offer pages, booking, unsubscribe) are served by Next.js server routes
  using the service-role key.
