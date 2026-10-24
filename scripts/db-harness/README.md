# Database test harness

A throwaway local Postgres with every migration applied in the order the live
database received them, plus SQL tests that act as each role the way the API
does. Nothing here touches the live server.

```sh
scripts/db-harness/run.sh                    # all migrations, then every test
scripts/db-harness/run.sh tests/010_x.sql    # all migrations, then one test
KEEP=1 scripts/db-harness/run.sh             # leave the server up to poke at
```

- `supabase-stubs.sql` stands in for the parts of Supabase the migrations use:
  the `anon` / `authenticated` / `service_role` roles and Supabase's default
  grants, `auth.users` and `auth.uid()` from the request's JWT claims,
  `storage.buckets` / `storage.objects` with `storage.foldername()`, and a
  recording `net.http_post`.
- pgvector is not packaged locally, so the embedding column becomes `real[]`
  here; no policy or grant depends on it.
- `hooks/<migration>.pre.sql` runs before that migration: changes the live
  database received by hand with no migration of their own (drift). Each one
  should eventually become a real migration.
- `lib/helpers.sql`: `t.make_user(email, role)`, `t.claims(user_id)` then
  `set local role authenticated` to act as that user, `t.visible(table)` for
  how many rows the current role can see (-1 when refused outright).

Write a test for every RLS, grant or function change: one file per concern in
`tests/`, wrapped in `begin; … rollback;`, failing with `raise exception` when
an expectation does not hold.
