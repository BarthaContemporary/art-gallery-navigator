-- 0097 §8 (database-11): an id that belongs to one register cannot be
-- inserted into the other (the insert used to flip piece_ref.ledger and
-- leave the work in both tables). Refused as a unique violation (PostgREST
-- 409) for staff and admin alike; register moves still work both ways, and
-- ordinary inserts are unaffected.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset

insert into public.pieces (title) values ('JvdB stock') returning id as jvb_id \gset
insert into public.external_pieces (title) values ('Not JvdB') returning id as ext_id \gset
select set_config('t.jvb_id', :'jvb_id', true), set_config('t.ext_id', :'ext_id', true);

-- Staff and admin, each register.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin
    insert into public.external_pieces (id, title) values (current_setting('t.jvb_id')::uuid, 'Second record');
    raise exception 'staff put a JvdB id into the external register';
  exception when unique_violation then
    if sqlerrm not like '%already in the jvb register%' then raise; end if;
  end;
  begin
    insert into public.pieces (id, title) values (current_setting('t.ext_id')::uuid, 'Second record');
    raise exception 'staff put an external id into the JvdB register';
  exception when unique_violation then null;
  end;
end $$;
reset role;

select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  begin
    insert into public.external_pieces (id, title) values (current_setting('t.jvb_id')::uuid, 'Second record');
    raise exception 'admin put a JvdB id into the external register';
  exception when unique_violation then null;
  end;
  -- A plain insert still works, and a duplicate id in the same register is
  -- the table's own primary-key error, as before.
  insert into public.pieces (title) values ('New record');
  begin
    insert into public.pieces (id, title) values (current_setting('t.jvb_id')::uuid, 'Same id again');
    raise exception 'a duplicate id in the same register was accepted';
  exception when unique_violation then
    if sqlerrm not like '%pieces_pkey%' then raise; end if;
  end;
end $$;
reset role;

do $$ begin
  if (select ledger from public.piece_ref where id = current_setting('t.jvb_id')::uuid) <> 'jvb'
     or (select ledger from public.piece_ref where id = current_setting('t.ext_id')::uuid) <> 'external' then
    raise exception 'a refused insert changed the ledger';
  end if;
  if (select count(*) from public.vw_pieces_list where id in (current_setting('t.jvb_id')::uuid,
                                                               current_setting('t.ext_id')::uuid)) <> 2 then
    raise exception 'a work appears in both registers';
  end if;
end $$;

-- Moves, both ways, as admin.
select t.claims(:'admin_id');
set local role authenticated;
select public.move_piece_ledger(:'jvb_id', 'external') as to_ext \gset
select public.move_piece_ledger(:'jvb_id', 'jvb') as back_to_jvb \gset
select public.move_piece_ledger(:'ext_id', 'jvb') as ext_to_jvb \gset
reset role;
do $$ begin
  if not exists (select 1 from public.pieces where id = current_setting('t.jvb_id')::uuid)
     or exists (select 1 from public.external_pieces where id = current_setting('t.jvb_id')::uuid)
     or (select ledger from public.piece_ref where id = current_setting('t.jvb_id')::uuid) <> 'jvb' then
    raise exception 'a move out and back did not land in the JvdB register';
  end if;
  if not exists (select 1 from public.pieces where id = current_setting('t.ext_id')::uuid)
     or (select ledger from public.piece_ref where id = current_setting('t.ext_id')::uuid) <> 'jvb' then
    raise exception 'a move from the external register failed';
  end if;
end $$;
rollback;
