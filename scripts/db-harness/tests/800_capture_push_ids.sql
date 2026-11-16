-- The capture push (apps/capture/src/lib/push.ts) gives a work's stock record
-- the capture work's own id, so a retried or overlapping push can never make
-- a second record. It relies on what 0004 and 0056 already do, checked here
-- as the service role the push writes with:
--   * a supplied id is kept, in either register, and recorded in piece_ref;
--   * a second insert with that id is refused as 23505 (unique_violation),
--     and the refused insert uses no stock number;
--   * capture_works.pushed_piece_id can point at the record.
\ir ../lib/helpers.sql
begin;
insert into public.capture_batches (source_name) values ('Galerie Example') returning id as batch_id \gset
insert into public.capture_works (batch_id, title) values (:'batch_id', 'Inro') returning id as work_id \gset
insert into public.capture_works (batch_id, title) values (:'batch_id', 'Screen') returning id as ext_work_id \gset
select set_config('t.work_id', :'work_id', true), set_config('t.ext_work_id', :'ext_work_id', true) \gset
set local role service_role;

-- JvdB register.
insert into public.pieces (id, title, tags, needs_completion)
  values (:'work_id', 'Inro', array['capture'], true)
  returning stock_number as first_number \gset
select set_config('t.first_number', :'first_number', true) \gset
do $$
declare
  _work uuid := current_setting('t.work_id')::uuid;
  _first text := current_setting('t.first_number');
  _state text;
  _next text;
begin
  if not exists (select 1 from public.piece_ref where id = _work and ledger = 'jvb') then
    raise exception 'piece_ref should hold the supplied id';
  end if;
  if not exists (select 1 from public.piece_financials where piece_id = _work) then
    raise exception 'the financials row should exist for the supplied id';
  end if;

  begin
    insert into public.pieces (id, title) values (_work, 'Inro again');
    raise exception 'a second record with the same id was accepted';
  exception when unique_violation then
    get stacked diagnostics _state = returned_sqlstate;
  end;
  if _state <> '23505' then raise exception 'expected 23505, got %', _state; end if;
  if (select count(*) from public.pieces where id = _work) <> 1 then
    raise exception 'one record for the work';
  end if;

  insert into public.pieces (title) values ('Next work') returning stock_number into _next;
  if split_part(_next, '-', 2)::int <> split_part(_first, '-', 2)::int + 1 then
    raise exception 'the refused insert used a stock number: % after %', _next, _first;
  end if;
end $$;

-- The other register.
insert into public.external_pieces (id, title, tags, needs_completion)
  values (:'ext_work_id', 'Screen', array['capture'], true)
  returning stock_number as ext_number \gset
select set_config('t.ext_number', :'ext_number', true) \gset
do $$
declare
  _work uuid := current_setting('t.ext_work_id')::uuid;
  _state text;
begin
  if current_setting('t.ext_number') not like 'X-%' then raise exception 'external series expected'; end if;
  if not exists (select 1 from public.piece_ref where id = _work and ledger = 'external') then
    raise exception 'piece_ref should hold the supplied external id';
  end if;
  begin
    insert into public.external_pieces (id, title) values (_work, 'Screen again');
    raise exception 'a second external record with the same id was accepted';
  exception when unique_violation then
    get stacked diagnostics _state = returned_sqlstate;
  end;
  if _state <> '23505' then raise exception 'expected 23505, got %', _state; end if;
end $$;

-- The work records its record.
update public.capture_works set pushed_piece_id = id where batch_id = :'batch_id';
do $$ begin
  if (select count(*) from public.capture_works where pushed_piece_id = id) <> 2 then
    raise exception 'pushed_piece_id should point at the records';
  end if;
end $$;
reset role;
rollback;
