-- 0053: record backup runs so the studio dashboard can show backup health.
--
-- backup.sh (on the VPS) inserts a row on each successful run via a local psql
-- as the postgres superuser (bypasses RLS). The dashboard reads the latest row
-- per kind and flags anything stale. This is the in-app complement to the
-- external healthchecks.io dead-man's-switch.

create table if not exists backup_runs (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('db', 'webdav', 'storage')),
  status      text not null default 'ok' check (status in ('ok', 'error')),
  detail      text,
  size_bytes  bigint,
  created_at  timestamptz not null default now()
);

create index if not exists idx_backup_runs_kind_time on backup_runs (kind, created_at desc);

alter table backup_runs enable row level security;

-- Admins read backup health; nobody writes through the API (only the local
-- backup script, as superuser, records runs).
drop policy if exists backup_runs_admin_read on backup_runs;
create policy backup_runs_admin_read on backup_runs
  for select to authenticated
  using (public.has_any_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
