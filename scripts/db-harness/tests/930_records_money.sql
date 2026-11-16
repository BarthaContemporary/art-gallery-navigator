-- 0098: J.v.d.B.'s share in the stock-book views waits for a sale £; a work
-- with a sale on record is kept: staff cannot purge it, the nightly purge
-- leaves it in the trash, an administrator still can. The accountant's
-- write to the figures changes nothing (the studio no longer offers one).
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- A consigned work at 50%, with £500 restoration on top of a £1,000 purchase.
insert into public.pieces (title, consignment_share_pct, sale_handled_by_jvb)
values ('Consigned bowl', 50, true) returning id as consigned_id \gset
update public.piece_financials
   set purchase_cost_gbp = 1000, restoration_cost_gbp = 500, vat_treatment = 'zero_rated'
 where piece_id = :'consigned_id';
select set_config('t.consigned_id', :'consigned_id', true);

-- Unsold: no share in any of the five views (was the £500 of costs).
do $$
declare
  _v text;
  _share numeric;
  _found boolean;
begin
  foreach _v in array array['vw_stock_book_all', 'vw_stock_book_zero_rated'] loop
    execute format('select true, jvb_share_gbp from public.%I where piece_id = $1', _v)
      into _found, _share using current_setting('t.consigned_id')::uuid;
    if not coalesce(_found, false) then raise exception '% lost the unsold work', _v; end if;
    if _share is not null then raise exception '% shows a share of % for an unsold work', _v, _share; end if;
  end loop;
end $$;

-- Sold for £10,000 zero-rated: pool 9,500, half of it plus the £500 = 5,250.
update public.piece_financials set sold_price_gbp = 10000, sold_date = current_date
 where piece_id = :'consigned_id';
do $$
declare _share numeric;
begin
  select jvb_share_gbp into _share from public.vw_stock_book_all where piece_id = current_setting('t.consigned_id')::uuid;
  if _share is distinct from 5250 then raise exception 'sold share is %, expected 5250', _share; end if;
  select jvb_share_gbp into _share from public.vw_stock_book_zero_rated where piece_id = current_setting('t.consigned_id')::uuid;
  if _share is distinct from 5250 then raise exception 'zero-rated view share is %, expected 5250', _share; end if;
end $$;

-- The views still run as the caller: staff see none of the book.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if t.visible('public.vw_stock_book_all') > 0 then raise exception 'staff can read vw_stock_book_all'; end if;
  if t.visible('public.vw_stock_book') > 0 then raise exception 'staff can read vw_stock_book'; end if;
  if t.visible('public.vw_stock_book_standard') > 0 then raise exception 'staff can read vw_stock_book_standard'; end if;
  if t.visible('public.vw_stock_book_zero_rated') > 0 then raise exception 'staff can read vw_stock_book_zero_rated'; end if;
  if t.visible('public.vw_stock_book_outside_scope') > 0 then raise exception 'staff can read vw_stock_book_outside_scope'; end if;
end $$;
reset role;

-- The accountant reads the book, and an update of the figures changes nothing.
select t.claims(:'acc_id');
set local role authenticated;
do $$
declare _n int;
begin
  if t.visible('public.vw_stock_book_all') < 1 then raise exception 'the accountant cannot read the stock book'; end if;
  with u as (
    update public.piece_financials set purchase_cost_gbp = 1 where piece_id = current_setting('t.consigned_id')::uuid
    returning 1)
  select count(*) into _n from u;
  if _n <> 0 then raise exception 'the accountant changed the figures'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Sold works are kept.
-- ---------------------------------------------------------------------------
insert into public.pieces (title, deleted_at) values ('Sold, trashed', now() - interval '40 days')
returning id as sold_id \gset
update public.piece_financials set sold_date = current_date - 400, sold_price_gbp = 1200 where piece_id = :'sold_id';
insert into public.pieces (title, deleted_at) values ('Unsold, trashed', now() - interval '40 days')
returning id as unsold_id \gset
insert into public.pieces (title, deleted_at) values ('Sold, trashed, admin', now() - interval '1 day')
returning id as admin_sold_id \gset
update public.piece_financials set sold_price = 800 where piece_id = :'admin_sold_id';
select set_config('t.sold_id', :'sold_id', true);
select set_config('t.unsold_id', :'unsold_id', true);
select set_config('t.admin_sold_id', :'admin_sold_id', true);

-- Staff: the sold one is refused with a sentence; the unsold one goes.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin
    delete from public.pieces where id = current_setting('t.sold_id')::uuid;
    raise exception 'staff purged a sold work';
  exception when insufficient_privilege then
    if sqlerrm not like 'This work has a sale on record%' then raise; end if;
  end;
  delete from public.pieces where id = current_setting('t.unsold_id')::uuid;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.pieces where id = current_setting('t.sold_id')::uuid) then
    raise exception 'the sold work is gone';
  end if;
  if not exists (select 1 from public.piece_financials where piece_id = current_setting('t.sold_id')::uuid) then
    raise exception 'the sold work lost its figures';
  end if;
  if exists (select 1 from public.pieces where id = current_setting('t.unsold_id')::uuid) then
    raise exception 'staff could not purge an unsold work';
  end if;
end $$;

-- The nightly purge leaves the sold work in the trash and takes the rest.
insert into public.pieces (title, deleted_at) values ('Old draft', now() - interval '40 days')
returning id as old_id \gset
select set_config('t.old_id', :'old_id', true);
select public.purge_deleted_pieces() as purged \gset
do $$ begin
  if not exists (select 1 from public.pieces where id = current_setting('t.sold_id')::uuid) then
    raise exception 'the nightly purge removed a sold work';
  end if;
  if exists (select 1 from public.pieces where id = current_setting('t.old_id')::uuid) then
    raise exception 'the nightly purge kept an unsold trashed work';
  end if;
end $$;

-- An administrator may still remove one (a true duplicate).
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  delete from public.pieces where id = current_setting('t.admin_sold_id')::uuid;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.pieces where id = current_setting('t.admin_sold_id')::uuid) then
    raise exception 'an administrator could not remove a sold work';
  end if;
end $$;

-- The guard is not callable on its own.
do $$ begin
  if has_function_privilege('authenticated', 'public.guard_sold_piece_delete()', 'execute')
     or has_function_privilege('anon', 'public.guard_sold_piece_delete()', 'execute') then
    raise exception 'guard_sold_piece_delete is executable by signed-in or anonymous users';
  end if;
end $$;
rollback;
