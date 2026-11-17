-- 0097 §3 (database-4, studio-api-b-3): changing a maker's name, romanised
-- or native name, or life dates queues the maker and then its web-visible,
-- untrashed works in both registers (their website documents carry copies
-- of those fields), once while they wait. Other maker edits queue only the
-- maker, as before; a delete still queues the maker's delete.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

insert into public.makers (display_name, life_dates) values ('Unno Shomin', '1844-') returning id as maker_id \gset
insert into public.pieces (title, maker_id, web_visible) values ('Published tsuba', :'maker_id', true) returning id as w1 \gset
insert into public.external_pieces (title, maker_id, web_visible) values ('Published box', :'maker_id', true) returning id as w2 \gset
insert into public.pieces (title, maker_id, web_visible) values ('Not published', :'maker_id', false) returning id as w3 \gset
insert into public.pieces (title, maker_id, web_visible, deleted_at) values ('Trashed', :'maker_id', true, now()) returning id as w4 \gset
insert into public.makers (display_name) values ('Someone else') returning id as other_id \gset
insert into public.pieces (title, maker_id, web_visible) values ('Other maker''s work', :'other_id', true) returning id as w5 \gset
select set_config('t.maker_id', :'maker_id', true), set_config('t.w1', :'w1', true),
       set_config('t.w2', :'w2', true);

delete from public.sync_outbox;

-- A rename and new dates, typed by staff on the maker page (two debounced saves).
select t.claims(:'staff_id');
set local role authenticated;
update public.makers set romanized_name = 'Unno Shōmin', display_name = 'Unno Shōmin' where id = :'maker_id';
update public.makers set life_dates = '1844–1915' where id = :'maker_id';
reset role;

do $$
declare
  _maker uuid := current_setting('t.maker_id')::uuid;
  _first_piece bigint;
  _last_maker bigint;
begin
  if (select count(*) from public.sync_outbox where entity_type = 'maker' and entity_id = _maker and op = 'upsert') <> 2 then
    raise exception 'each maker save should still queue the maker';
  end if;
  if (select count(*) from public.sync_outbox where entity_type = 'piece') <> 2
     or (select count(distinct entity_id) from public.sync_outbox where entity_type = 'piece') <> 2
     or not exists (select 1 from public.sync_outbox where entity_type = 'piece' and entity_id = current_setting('t.w1')::uuid)
     or not exists (select 1 from public.sync_outbox where entity_type = 'piece' and entity_id = current_setting('t.w2')::uuid) then
    raise exception 'the rename should queue the two web-visible, untrashed works, once each: %',
      (select array_agg(entity_id) from public.sync_outbox where entity_type = 'piece');
  end if;
  select min(id) into _first_piece from public.sync_outbox where entity_type = 'piece';
  select min(id) into _last_maker from public.sync_outbox where entity_type = 'maker';
  if _last_maker > _first_piece then
    raise exception 'the maker must be queued before its works (artists are built first)';
  end if;
end $$;

-- Once the sync has claimed those rows, the next rename queues the works again.
update public.sync_outbox set claimed_at = now();
update public.makers set native_name = '海野勝珉' where id = :'maker_id';
do $$ begin
  if (select count(*) from public.sync_outbox where entity_type = 'piece' and claimed_at is null) <> 2 then
    raise exception 'a rename after the sync claimed the works should queue them again';
  end if;
end $$;

-- Profile text, the website switch and the sync's own portrait-focus write:
-- the maker only.
delete from public.sync_outbox;
update public.makers set biography = 'Chaser to the Imperial Household', region = 'Japan' where id = :'maker_id';
update public.makers set web_visible = true where id = :'maker_id';
update public.makers set portrait_focus = '{"x": 0.5, "y": 0.3}'::jsonb where id = :'maker_id';
update public.makers set life_dates = '1844–1915' where id = :'maker_id';  -- unchanged value
do $$ begin
  if exists (select 1 from public.sync_outbox where entity_type = 'piece') then
    raise exception 'an edit that leaves the four copied fields alone queued works';
  end if;
  if (select count(*) from public.sync_outbox where entity_type = 'maker') <> 4 then
    raise exception 'each maker edit should still queue the maker';
  end if;
end $$;

-- A delete: the maker's delete, as before (its works are unlinked by their own trigger).
delete from public.sync_outbox;
delete from public.makers where id = :'other_id';
do $$ begin
  if not exists (select 1 from public.sync_outbox where entity_type = 'maker' and op = 'delete') then
    raise exception 'deleting a maker should queue its delete';
  end if;
end $$;
rollback;
