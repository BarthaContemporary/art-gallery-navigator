-- 0097 §9 (database-12): vw_pieces_all carries every column of the stock
-- tables. `select p.*` is fixed when a view is created, so a column added
-- to pieces and external_pieces is missing from the view until it is
-- rebuilt; this fails until it is. (Not in vw_ledger_schema_drift: a
-- non-empty drift view blocks every register move.)
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset
do $$
declare
  _missing text;
begin
  select string_agg(c.column_name, ', ' order by c.ordinal_position) into _missing
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'pieces'
     and not exists (select 1 from information_schema.columns v
                      where v.table_schema = 'public' and v.table_name = 'vw_pieces_all'
                        and v.column_name = c.column_name);
  if _missing is not null then
    raise exception 'vw_pieces_all lacks: % (rebuild it in the migration that added them)', _missing;
  end if;
  if not exists (select 1 from pg_class where oid = 'public.vw_pieces_all'::regclass
                  and reloptions @> array['security_invoker=true']) then
    raise exception 'vw_pieces_all must run with the reader''s rights';
  end if;
  if has_table_privilege('anon', 'public.vw_pieces_all', 'select') then
    raise exception 'anon can read vw_pieces_all';
  end if;
end $$;

-- Readable by a signed-in user through RLS, from either register.
insert into public.pieces (title, presentation) values ('Flat print', 'flat');
insert into public.external_pieces (title) values ('Consigned screen');
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if (select count(*) from public.vw_pieces_all where title in ('Flat print', 'Consigned screen')) <> 2
     or (select presentation from public.vw_pieces_all where title = 'Flat print') <> 'flat' then
    raise exception 'vw_pieces_all does not show both registers with presentation';
  end if;
end $$;
reset role;
rollback;
