-- ---------------------------------------------------------------------------
-- 0080 — log of retention runs, so Admin → Data protection can show when the
-- schedule last ran and what it removed (a run that deletes nothing is still
-- a run). Written by the nightly cron and the "Run retention now" button.
-- ---------------------------------------------------------------------------
create table if not exists public.dp_retention_runs (
  id           bigserial primary key,
  ran_at       timestamptz not null default now(),
  triggered_by text not null default 'cron',
  result       jsonb not null
);
alter table public.dp_retention_runs enable row level security;
drop policy if exists admin_all on public.dp_retention_runs;
create policy admin_all on public.dp_retention_runs
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.dp_retention_runs from anon;

notify pgrst, 'reload schema';
