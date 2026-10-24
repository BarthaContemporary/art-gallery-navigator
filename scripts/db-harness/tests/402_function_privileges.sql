-- 0093 (F10): SECURITY DEFINER functions are not callable through PUBLIC or
-- anon; signed-in users keep only what the apps call with their own session;
-- the stock-number counters cannot be pushed into a collision and the purge
-- jobs cannot be given a grace that deletes work in progress; new functions
-- are not executable by PUBLIC.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset
select extract(year from now())::int as yr \gset
select set_config('t.yr', :'yr', true);

-- ---------------------------------------------------------------------------
-- The grants themselves.
-- ---------------------------------------------------------------------------
do $$
declare
  _bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into _bad
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosecdef and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
     and (has_function_privilege('anon', p.oid, 'execute')
          or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                      where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  if _bad is not null then raise exception 'callable through anon or PUBLIC: %', _bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into _bad
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('next_stock_number', 'next_external_stock_number', 'purge_blank_draft_pieces',
                       'purge_deleted_pieces', 'purge_empty_shipments', 'queue_list_sync',
                       'contact_legal_holds', 'contacts_with_weak_marketing_basis', 'erase_contact',
                       'apply_retention', 'claim_sync_outbox', 'rate_limit_hit')
     and has_function_privilege('authenticated', p.oid, 'execute');
  if _bad is not null then raise exception 'signed-in users can still call: %', _bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into _bad
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('has_role', 'has_any_role', 'is_invoice_object', 'move_piece_ledger',
                       'pieces_search', 'crm_contacts_search')
     and not has_function_privilege('authenticated', p.oid, 'execute');
  if _bad is not null then raise exception 'signed-in users lost: %', _bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into _bad
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosecdef and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
     and not has_function_privilege('service_role', p.oid, 'execute');
  if _bad is not null then raise exception 'service role lost: %', _bad; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Anon (the public key in every browser): none of it.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin perform public.next_stock_number(current_setting('t.yr')::int); raise exception 'anon could call next_stock_number';
  exception when insufficient_privilege then null; end;
  begin perform public.next_external_stock_number(current_setting('t.yr')::int); raise exception 'anon could call next_external_stock_number';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_blank_draft_pieces('-1 hour'); raise exception 'anon could call purge_blank_draft_pieces';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_empty_shipments('-1 day'); raise exception 'anon could call purge_empty_shipments';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_deleted_pieces(); raise exception 'anon could call purge_deleted_pieces';
  exception when insufficient_privilege then null; end;
  begin perform public.queue_list_sync(gen_random_uuid()); raise exception 'anon could call queue_list_sync';
  exception when insufficient_privilege then null; end;
  begin perform public.has_role(gen_random_uuid(), 'admin'); raise exception 'anon could call has_role';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_function_exposure') > 0 then raise exception 'anon can read vw_function_exposure'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Staff: the counters and the purge jobs are out of reach, but creating
-- records (which numbers them through the triggers), publishing a list and
-- searching all still work, and moving a record is refused by the function's
-- own admin check rather than by a missing grant.
-- ---------------------------------------------------------------------------
insert into public.pieces (title) values ('To be moved') returning id as move_id \gset
select set_config('t.move_id', :'move_id', true);
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare
  _sn text;
  _list uuid;
begin
  begin perform public.next_stock_number(current_setting('t.yr')::int); raise exception 'staff could call next_stock_number';
  exception when insufficient_privilege then null; end;
  begin perform public.next_external_stock_number(current_setting('t.yr')::int); raise exception 'staff could call next_external_stock_number';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_blank_draft_pieces('-1 hour'); raise exception 'staff could call purge_blank_draft_pieces';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_empty_shipments('-1 day'); raise exception 'staff could call purge_empty_shipments';
  exception when insufficient_privilege then null; end;
  begin perform public.queue_list_sync(gen_random_uuid()); raise exception 'staff could call queue_list_sync';
  exception when insufficient_privilege then null; end;

  insert into public.pieces (title) values ('Staff record') returning stock_number into _sn;
  if _sn !~ ('^' || current_setting('t.yr') || '-\d{4,}$') then raise exception 'staff record got number %', _sn; end if;
  insert into public.external_pieces (title) values ('Staff consignment') returning stock_number into _sn;
  if _sn !~ ('^X-' || current_setting('t.yr') || '-\d{4,}$') then raise exception 'staff external record got number %', _sn; end if;

  insert into public.piece_lists (name, web_visible) values ('On the website', true) returning id into _list;
  perform set_config('t.list_id', _list::text, true);

  perform public.pieces_search('Staff');
  if not public.has_role(auth.uid(), 'staff') then raise exception 'has_role should work for staff'; end if;

  begin
    perform public.move_piece_ledger(current_setting('t.move_id')::uuid, 'external');
    raise exception 'staff could move a record';
  exception when insufficient_privilege then raise exception 'move_piece_ledger lost its grant';
            when raise_exception then
              if sqlerrm not like 'Only an administrator%' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.sync_outbox where entity_type = 'list'
                  and entity_id = current_setting('t.list_id')::uuid) then
    raise exception 'publishing a list should still queue it for the website';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Accountant: none of the counters or jobs either.
-- ---------------------------------------------------------------------------
select t.claims(:'acc_id');
set local role authenticated;
do $$ begin
  begin perform public.next_stock_number(current_setting('t.yr')::int); raise exception 'accountant could call next_stock_number';
  exception when insufficient_privilege then null; end;
  begin perform public.purge_deleted_pieces(); raise exception 'accountant could call purge_deleted_pieces';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_function_exposure') > 0 then raise exception 'accountant can read vw_function_exposure'; end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Admin: moving a record between registers still works (it numbers the
-- record from the other series inside the function); the counters
-- themselves are not an admin RPC either.
-- ---------------------------------------------------------------------------
select t.claims(:'admin_id');
set local role authenticated;
do $$
declare
  _sn text;
begin
  _sn := public.move_piece_ledger(current_setting('t.move_id')::uuid, 'external');
  if _sn !~ ('^X-' || current_setting('t.yr') || '-\d{4,}$') then raise exception 'move gave number %', _sn; end if;
  begin perform public.next_stock_number(current_setting('t.yr')::int); raise exception 'admin could call next_stock_number directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Service role: everything the cron and the sync call.
-- ---------------------------------------------------------------------------
-- Blank drafts 30 minutes, 90 minutes and three hours old; empty shipments
-- two hours and three days old.
insert into public.pieces (created_at) values (now() - interval '30 minutes') returning id as draft_new \gset
insert into public.pieces (created_at) values (now() - interval '90 minutes') returning id as draft_mid \gset
insert into public.pieces (created_at) values (now() - interval '3 hours')    returning id as draft_old \gset
insert into public.shipments (kind, created_at) values ('import', now() - interval '2 hours') returning id as ship_new \gset
insert into public.shipments (kind, created_at) values ('import', now() - interval '3 days')  returning id as ship_old \gset
select set_config('t.draft_new', :'draft_new', true), set_config('t.draft_mid', :'draft_mid', true),
       set_config('t.draft_old', :'draft_old', true), set_config('t.ship_new', :'ship_new', true),
       set_config('t.ship_old', :'ship_old', true);

-- A year whose series has reached 9999, next to an existing record whose
-- number the old lpad() would have produced again.
insert into public.stock_number_counters (year, last_seq) values (:yr, 9999)
  on conflict (year) do update set last_seq = 9999;
insert into public.external_stock_number_counters (year, last_seq) values (:yr, 9999)
  on conflict (year) do update set last_seq = 9999;
insert into public.pieces (title, stock_number) values ('Old number', :'yr' || '-1000');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  _yr int := current_setting('t.yr')::int;
  _sn text;
begin
  _sn := public.next_stock_number(_yr);
  if _sn <> _yr || '-10000' then raise exception 'past 9999 the number should grow, got %', _sn; end if;
  _sn := public.next_external_stock_number(_yr);
  if _sn <> 'X-' || _yr || '-10000' then raise exception 'past 9999 the X- number should grow, got %', _sn; end if;
  insert into public.pieces (title) values ('After 9999') returning stock_number into _sn;
  if _sn <> _yr || '-10001' then raise exception 'the trigger should number on, got %', _sn; end if;

  if public.next_stock_number(_yr + 1) <> (_yr + 1) || '-0001' then raise exception 'next year should start at 0001'; end if;
  begin perform public.next_stock_number(99999); raise exception 'year 99999 accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.next_stock_number(1899); raise exception 'year 1899 accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.next_external_stock_number(-1); raise exception 'year -1 accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.next_stock_number(_yr + 2); raise exception 'a year two ahead accepted';
  exception when invalid_parameter_value then null; end;

  -- A negative or zero grace is raised to an hour: the 90-minute and
  -- three-hour drafts go, the 30-minute one stays.
  perform public.purge_blank_draft_pieces('-1 hour');
  perform public.purge_blank_draft_pieces('0');
  perform public.purge_blank_draft_pieces(null);
  if not exists (select 1 from public.pieces where id = current_setting('t.draft_new')::uuid) then
    raise exception 'a 30-minute-old draft was purged';
  end if;
  if exists (select 1 from public.pieces where id in (current_setting('t.draft_mid')::uuid, current_setting('t.draft_old')::uuid)) then
    raise exception 'drafts older than the minimum grace should be purged';
  end if;

  perform public.purge_empty_shipments('-5 days');
  if not exists (select 1 from public.shipments where id = current_setting('t.ship_new')::uuid) then
    raise exception 'a two-hour-old shipment was purged';
  end if;
  if exists (select 1 from public.shipments where id = current_setting('t.ship_old')::uuid) then
    raise exception 'a three-day-old empty shipment should be purged';
  end if;

  perform public.purge_deleted_pieces();
  perform public.queue_list_sync(gen_random_uuid());

  if exists (select 1 from public.vw_function_exposure where anon_can_execute or public_can_execute) then
    raise exception 'vw_function_exposure reports a function open to anon or PUBLIC';
  end if;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- New functions: not executable by PUBLIC (or anon); Supabase's own
-- per-schema default still grants signed-in users and the service role.
-- ---------------------------------------------------------------------------
create function public.t402_probe() returns int language sql security definer set search_path = public as 'select 1';
do $$ begin
  if has_function_privilege('anon', 'public.t402_probe()', 'execute') then
    raise exception 'a new function is executable by anon';
  end if;
  if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              where p.oid = 'public.t402_probe()'::regprocedure and a.grantee = 0) then
    raise exception 'a new function is executable by PUBLIC';
  end if;
  if not has_function_privilege('service_role', 'public.t402_probe()', 'execute') then
    raise exception 'a new function should still be executable by the service role';
  end if;
end $$;
rollback;
