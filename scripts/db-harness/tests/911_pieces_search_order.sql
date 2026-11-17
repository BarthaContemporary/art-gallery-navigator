-- 0097 §2 (database-3): pieces_search ranks exact and stock-number matches
-- first and text matches by relevance, whether or not a work has a legacy
-- (FileMaker) number. Works created since the import have none, and used to
-- sort ahead of everything.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

-- Two imported works with legacy numbers, and post-import works without.
insert into public.pieces (title, legacy_stock_number) values ('Tsuba', '1001');
insert into public.pieces (title, legacy_stock_number) values ('Iron tsuba, Edo period', '1002');
insert into public.pieces (title, description) values ('Lacquer box', 'A box for a tsuba, with a cord.');
insert into public.pieces (title, legacy_stock_number) values ('Bowl', '338');
insert into public.external_pieces (title) values ('Vase 1338');
insert into public.external_pieces (title) values ('Plate 338 B');

select t.claims(:'staff_id');
set local role authenticated;
do $$
declare
  _titles text[];
begin
  select array_agg(title) into _titles from public.pieces_search('tsuba');
  if _titles[1] is distinct from 'Tsuba' then
    raise exception 'tsuba: the best title match should come first, got %', _titles;
  end if;
  if _titles[array_length(_titles, 1)] is distinct from 'Lacquer box' then
    raise exception 'tsuba: a work mentioning it only in the description should come last, got %', _titles;
  end if;

  select array_agg(title) into _titles from public.pieces_search('338');
  if _titles[1] is distinct from 'Bowl' then
    raise exception '338: the work whose legacy number is exactly 338 should come first, got %', _titles;
  end if;

  -- An exact stock number beats everything, in either register.
  select array_agg(stock_number) into _titles
    from public.pieces_search((select stock_number from public.external_pieces where title = 'Vase 1338'));
  if _titles[1] is distinct from (select stock_number from public.external_pieces where title = 'Vase 1338') then
    raise exception 'an exact stock number should come first, got %', _titles;
  end if;
end $$;
reset role;

do $$ begin
  if has_function_privilege('anon', 'public.pieces_search(text)', 'execute') then
    raise exception 'anon can search the inventory';
  end if;
  if not has_function_privilege('authenticated', 'public.pieces_search(text)', 'execute') then
    raise exception 'signed-in users lost pieces_search';
  end if;
end $$;
rollback;
