-- 0094_sanity_asset_cleanup
-- Images the website sync uploaded to Sanity and that nothing shows any more
-- are deleted from the public dataset (security review 2026-10, finding F17).
--
-- sanity_assets (0072) remembers the Sanity image asset the sync uploaded for
-- each storage path. Until now a row was simply deleted, or its asset id
-- overwritten, when a photograph was rotated, its square tile re-rendered or
-- its master re-derived: the old asset stayed public and nothing remembered
-- it was the sync's. Such asset ids are now filed in sanity_assets_retired,
-- so the sync and the cleanup cron (studio /api/cron/sanity-assets) still
-- know them as the sync's own and delete them once no document references
-- them. Editors' uploads are in neither table and are never touched.
--
--   • sanity_assets_retired       asset ids the sync uploaded that no longer
--                                 stand for a storage path
--   • trg_sanity_assets_retire    files the old asset id there when a row is
--                                 deleted or given a new asset id, and takes
--                                 an asset back out when a row uses it again
--   • sanity_assets_under(prefixes)  the sync's assets for some works or
--                                 artists (their '<bucket>/<id>/' folders)
--   • sanity_assets_known(ids)    which of some asset ids are the sync's
--   • forget_sanity_assets(ids)   drop every row for assets deleted from Sanity
--
-- Service role only. No personal data: asset ids and storage paths.

create table if not exists public.sanity_assets_retired (
  asset_id     text not null,
  storage_path text not null,           -- '<bucket>/<path>' it was uploaded from
  retired_at   timestamptz not null default now(),
  primary key (asset_id, storage_path)
);

comment on table public.sanity_assets_retired is
  'Sanity image assets the website sync uploaded that no storage path maps to any more; deleted from Sanity once unreferenced.';

alter table public.sanity_assets_retired enable row level security;
revoke all on public.sanity_assets_retired from public, anon, authenticated;
grant all on public.sanity_assets_retired to service_role;

-- Lookups by asset id (several paths can share one asset: Sanity names an
-- asset by its content, so identical files are one asset).
create index if not exists sanity_assets_asset_id on public.sanity_assets (asset_id);

create or replace function public.retire_sanity_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The old asset no longer stands for this path.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.asset_id is distinct from old.asset_id) then
    insert into public.sanity_assets_retired (asset_id, storage_path)
    values (old.asset_id, old.storage_path)
    on conflict (asset_id, storage_path) do update set retired_at = now();
  end if;
  -- An asset in use again (the same file uploaded anew) is no longer retired.
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.asset_id is distinct from old.asset_id) then
    delete from public.sanity_assets_retired where asset_id = new.asset_id;
    if tg_op = 'UPDATE' then
      new.uploaded_at := now();
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.retire_sanity_asset() from public, anon, authenticated;

drop trigger if exists trg_sanity_assets_retire on public.sanity_assets;
create trigger trg_sanity_assets_retire
  before insert or update or delete on public.sanity_assets
  for each row execute function public.retire_sanity_asset();

-- The sync's assets filed under any of these '<bucket>/<id>/' prefixes, live
-- or retired, with the latest upload of each (null when only retired).
create or replace function public.sanity_assets_under(_prefixes text[])
returns table (asset_id text, last_uploaded_at timestamptz)
language sql
stable
set search_path = public
as $$
  with p as (
    select x from unnest(_prefixes) as x where coalesce(x, '') <> ''
  ), mine as (
    select a.asset_id from public.sanity_assets a
     where exists (select 1 from p where starts_with(a.storage_path, p.x))
    union
    select r.asset_id from public.sanity_assets_retired r
     where exists (select 1 from p where starts_with(r.storage_path, p.x))
  )
  select m.asset_id,
         (select max(a.uploaded_at) from public.sanity_assets a where a.asset_id = m.asset_id)
    from mine m;
$$;

-- Of these asset ids, the ones the sync uploaded, with the latest upload of each.
create or replace function public.sanity_assets_known(_asset_ids text[])
returns table (asset_id text, last_uploaded_at timestamptz)
language sql
stable
set search_path = public
as $$
  with mine as (
    select a.asset_id from public.sanity_assets a where a.asset_id = any(_asset_ids)
    union
    select r.asset_id from public.sanity_assets_retired r where r.asset_id = any(_asset_ids)
  )
  select m.asset_id,
         (select max(a.uploaded_at) from public.sanity_assets a where a.asset_id = m.asset_id)
    from mine m;
$$;

-- These assets are gone from Sanity: forget every row for them. Returns the
-- number of storage paths that pointed at them.
create or replace function public.forget_sanity_assets(_asset_ids text[])
returns integer
language plpgsql
set search_path = public
as $$
declare
  _n integer;
begin
  delete from public.sanity_assets where asset_id = any(_asset_ids);
  get diagnostics _n = row_count;
  -- The delete above filed them as retired; they are gone, so drop those too.
  delete from public.sanity_assets_retired where asset_id = any(_asset_ids);
  return _n;
end;
$$;

revoke all on function public.sanity_assets_under(text[]) from public, anon, authenticated;
revoke all on function public.sanity_assets_known(text[]) from public, anon, authenticated;
revoke all on function public.forget_sanity_assets(text[]) from public, anon, authenticated;
grant execute on function public.sanity_assets_under(text[]) to service_role;
grant execute on function public.sanity_assets_known(text[]) to service_role;
grant execute on function public.forget_sanity_assets(text[]) to service_role;

notify pgrst, 'reload schema';
