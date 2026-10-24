-- 0094: the sync's own Sanity assets are remembered when retired, found by
-- folder or by id, and forgotten once deleted; only the service role (the
-- sync and the cleanup cron) may use any of it, and the admin's existing
-- access to sanity_assets still works.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- As the service role, the way the sync writes the table.
set local role service_role;
insert into public.sanity_assets (storage_path, asset_id, uploaded_at) values
  ('piece-derivatives/p1/i1.jpg',          'image-a',  now() - interval '2 days'),
  ('piece-derivatives/p1/i2.jpg',          'image-b',  now() - interval '2 days'),
  ('piece-derivatives/p2/i3.jpg',          'image-c',  now() - interval '2 days'),
  ('piece-derivatives/p2/i4.jpg',          'image-c',  now() - interval '1 hour'),  -- the same file twice
  ('piece-derivatives/p10/i9.jpg',         'image-e',  now() - interval '2 days'),
  ('maker-portraits/m1/display-1.jpg',     'image-d',  now() - interval '2 days');

-- A row deleted (a photo rotated, a tile re-rendered) retires its asset.
delete from public.sanity_assets where storage_path = 'piece-derivatives/p1/i1.jpg';
do $$ begin
  if not exists (select 1 from public.sanity_assets_retired
                  where asset_id = 'image-a' and storage_path = 'piece-derivatives/p1/i1.jpg') then
    raise exception 'a deleted row did not retire its asset';
  end if;
end $$;

-- New pixels under the same path (the sync's upsert) retire the old asset
-- and restamp the upload time.
insert into public.sanity_assets (storage_path, asset_id) values ('piece-derivatives/p1/i2.jpg', 'image-b2')
  on conflict (storage_path) do update set asset_id = excluded.asset_id;
do $$ begin
  if not exists (select 1 from public.sanity_assets_retired where asset_id = 'image-b') then
    raise exception 'a replaced asset was not retired';
  end if;
  if (select uploaded_at from public.sanity_assets where storage_path = 'piece-derivatives/p1/i2.jpg') < now() - interval '1 minute' then
    raise exception 'the upload time was not renewed';
  end if;
end $$;

-- An upsert that keeps the same asset retires nothing.
insert into public.sanity_assets (storage_path, asset_id) values ('piece-derivatives/p2/i3.jpg', 'image-c')
  on conflict (storage_path) do update set asset_id = excluded.asset_id;
do $$ begin
  if exists (select 1 from public.sanity_assets_retired where asset_id = 'image-c') then
    raise exception 'an unchanged asset was retired';
  end if;
end $$;

-- A retired asset used again (the same file uploaded anew) is live, not retired.
insert into public.sanity_assets (storage_path, asset_id) values ('piece-derivatives/p3/i5.jpg', 'image-f');
delete from public.sanity_assets where storage_path = 'piece-derivatives/p3/i5.jpg';
insert into public.sanity_assets (storage_path, asset_id) values ('piece-derivatives/p3/i6.jpg', 'image-f');
do $$ begin
  if exists (select 1 from public.sanity_assets_retired where asset_id = 'image-f') then
    raise exception 'an asset in use again stayed retired';
  end if;
end $$;

-- By folder: live and retired assets under the prefix, each once, with the
-- latest upload (none when only retired); p1/ does not reach p10/.
do $$
declare
  _ids text[];
begin
  select array_agg(asset_id order by asset_id) into _ids
    from public.sanity_assets_under(array['piece-derivatives/p1/']);
  if _ids is distinct from array['image-a', 'image-b', 'image-b2'] then
    raise exception 'sanity_assets_under(p1/) gave %', _ids;
  end if;
  if (select last_uploaded_at from public.sanity_assets_under(array['piece-derivatives/p1/']) where asset_id = 'image-a') is not null then
    raise exception 'a retired-only asset has an upload time';
  end if;
  select array_agg(asset_id order by asset_id) into _ids
    from public.sanity_assets_under(array['piece-derivatives/p2/', 'maker-portraits/m1/']);
  if _ids is distinct from array['image-c', 'image-d'] then
    raise exception 'sanity_assets_under(p2/, m1/) gave %', _ids;
  end if;
  if (select last_uploaded_at from public.sanity_assets_under(array['piece-derivatives/p2/']) where asset_id = 'image-c')
       < now() - interval '2 hours' then
    raise exception 'the latest upload of a shared asset was not reported';
  end if;
  if exists (select 1 from public.sanity_assets_under(array['', null])) then
    raise exception 'an empty prefix matched';
  end if;
end $$;

-- By id: only the sync's own (live or retired).
do $$
declare
  _ids text[];
begin
  select array_agg(asset_id order by asset_id) into _ids
    from public.sanity_assets_known(array['image-a', 'image-c', 'image-editors-own']);
  if _ids is distinct from array['image-a', 'image-c'] then
    raise exception 'sanity_assets_known gave %', _ids;
  end if;
end $$;

-- Forgetting deleted assets removes every row for them, live and retired, and nothing else.
do $$
declare
  _n integer;
begin
  _n := public.forget_sanity_assets(array['image-c', 'image-a']);
  if _n <> 2 then raise exception 'forget_sanity_assets removed % paths, expected 2', _n; end if;
  if exists (select 1 from public.sanity_assets where asset_id in ('image-a', 'image-c'))
     or exists (select 1 from public.sanity_assets_retired where asset_id in ('image-a', 'image-c')) then
    raise exception 'forgotten assets left rows behind';
  end if;
  if not exists (select 1 from public.sanity_assets_retired where asset_id = 'image-b')
     or (select count(*) from public.sanity_assets) <> 4 then
    raise exception 'forget_sanity_assets touched other assets';
  end if;
end $$;
reset role;

-- Nobody else may call the functions (no grant, not merely failing on the
-- tables behind them) or read the retired assets.
do $$
declare
  _fn text;
  _role text;
begin
  foreach _fn in array array['public.sanity_assets_under(text[])', 'public.sanity_assets_known(text[])', 'public.forget_sanity_assets(text[])'] loop
    foreach _role in array array['anon', 'authenticated'] loop
      if has_function_privilege(_role, _fn, 'execute') then raise exception '% may execute %', _role, _fn; end if;
    end loop;
    if not has_function_privilege('service_role', _fn, 'execute') then raise exception 'service_role may not execute %', _fn; end if;
  end loop;
end $$;

create temporary table _callers (label text, uid uuid);
grant select on _callers to anon, authenticated;
insert into _callers values ('anon', null), ('staff', :'staff_id'), ('accountant', :'acc_id'), ('admin', :'admin_id');

do $$
declare
  _c record;
  _fn text;
begin
  for _c in select * from _callers loop
    if _c.uid is null then
      perform set_config('request.jwt.claims', '', true);
      set local role anon;
    else
      perform t.claims(_c.uid);
      set local role authenticated;
    end if;
    foreach _fn in array array[
      'select * from public.sanity_assets_under(array[''piece-derivatives/''])',
      'select * from public.sanity_assets_known(array[''image-b''])',
      'select public.forget_sanity_assets(array[''image-b''])'
    ] loop
      begin
        execute _fn;
        raise exception '% could run: %', _c.label, _fn;
      exception when insufficient_privilege then null;
      end;
    end loop;
    if t.visible('public.sanity_assets_retired') > 0 then
      raise exception '% can read sanity_assets_retired', _c.label;
    end if;
    reset role;
  end loop;
end $$;

-- Staff and the accountant still see no sanity_assets rows; the admin still
-- does, and an admin's delete still files the asset as retired.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if t.visible('public.sanity_assets') > 0 then raise exception 'staff can read sanity_assets'; end if;
end $$;
reset role;
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if t.visible('public.sanity_assets') <> 4 then raise exception 'the admin should see the 4 sanity_assets rows'; end if;
  delete from public.sanity_assets where storage_path = 'maker-portraits/m1/display-1.jpg';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.sanity_assets_retired where asset_id = 'image-d') then
    raise exception 'an admin delete did not retire its asset';
  end if;
end $$;
rollback;
