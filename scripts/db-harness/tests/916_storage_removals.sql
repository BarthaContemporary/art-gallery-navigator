-- 0097 §10 (database-9, studio-pages-inventory-8, studio-pages-ops-6):
-- deleting a photograph, a document, a shipment or a maker, purging a work,
-- replacing a path and every used or expired upload slip queue the old
-- object key in storage_removals. storage_removals_due() hands the sweep
-- only keys that have waited past the backup window (never under 35 days)
-- and that no row points at; a key a row points at again is forgotten.
-- The queue and its functions are the service role's alone.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- ---------------------------------------------------------------------------
-- Nobody but the service role reaches the queue.
-- ---------------------------------------------------------------------------
do $$
declare
  _r text;
begin
  foreach _r in array array['anon', 'authenticated'] loop
    if has_table_privilege(_r, 'public.storage_removals', 'select')
       or has_table_privilege(_r, 'public.storage_removals', 'insert')
       or has_table_privilege(_r, 'public.storage_removals', 'delete') then
      raise exception '% can reach storage_removals', _r;
    end if;
    if has_function_privilege(_r, 'public.storage_removals_due(interval, integer, boolean)', 'execute')
       or has_function_privilege(_r, 'public.storage_removals_forget(text, text[])', 'execute')
       or has_function_privilege(_r, 'public.queue_storage_removal(text, text)', 'execute')
       or has_function_privilege(_r, 'public.storage_paths_in_use()', 'execute')
       or has_function_privilege(_r, 'public.queue_storage_removals()', 'execute') then
      raise exception '% can call the storage-removal functions', _r;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.storage_removals_due(interval, integer, boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.storage_removals_forget(text, text[])', 'execute')
     or not has_table_privilege('service_role', 'public.storage_removals', 'select') then
    raise exception 'the service role lost the queue';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What gets queued, by whom.
-- ---------------------------------------------------------------------------
insert into public.pieces (title) values ('Bowl') returning id as p_id \gset
insert into public.piece_images (id, piece_id, role, storage_path_original, storage_path_display, processing_status)
  values ('00000000-0000-4000-8000-0000000000e1', :'p_id', 'front',
          :'p_id' || '/00000000-0000-4000-8000-0000000000f1.jpg',
          :'p_id' || '/00000000-0000-4000-8000-0000000000e1.jpg', 'done');
insert into public.piece_image_squares (image_id, guess, kind, square_path)
  values ('00000000-0000-4000-8000-0000000000e1', 'object', 'object',
          :'p_id' || '/00000000-0000-4000-8000-0000000000e1.sq-4000x3000.jpg');
-- Still being processed: the worker may yet upload its display master.
insert into public.piece_images (id, piece_id, role, storage_path_original, processing_status)
  values ('00000000-0000-4000-8000-0000000000e2', :'p_id', 'detail',
          :'p_id' || '/00000000-0000-4000-8000-0000000000f2.heic', 'processing');
insert into public.piece_documents (id, piece_id, doc_type, title, storage_path)
  values ('00000000-0000-4000-8000-0000000000d1', :'p_id', 'certificate', 'Certificate',
          :'p_id' || '/00000000-0000-4000-8000-0000000000d1.pdf');
insert into public.shipments (kind) values ('export') returning id as s_id \gset
insert into public.shipment_documents (shipment_id, title, storage_path)
  values (:'s_id', 'Packing list', 'shipments/' || :'s_id' || '/00000000-0000-4000-8000-0000000000c1.pdf');
insert into public.makers (display_name, portrait_path, portrait_original_path)
  values ('Shibata Zeshin', 'portrait-placeholder', 'original-placeholder') returning id as m_id \gset
update public.makers set portrait_path = :'m_id' || '/display-1.jpg', portrait_original_path = :'m_id' || '/original-1.jpg'
 where id = :'m_id';
delete from public.storage_removals;   -- the placeholders above

select set_config('t.p_id', :'p_id', true), set_config('t.s_id', :'s_id', true), set_config('t.m_id', :'m_id', true);

-- Staff, with their own session: re-render a square, delete a photograph,
-- a document, a shipment and replace then delete a maker's portrait.
select t.claims(:'staff_id');
set local role authenticated;
delete from public.piece_images where id = '00000000-0000-4000-8000-0000000000e2';
delete from public.piece_documents where id = '00000000-0000-4000-8000-0000000000d1';
delete from public.shipments where id = :'s_id';
update public.makers set portrait_path = :'m_id' || '/display-2.jpg' where id = :'m_id';
reset role;
-- The sync (service role) renders the square again for a new master size.
update public.piece_image_squares set square_path = :'p_id' || '/00000000-0000-4000-8000-0000000000e1.sq-6000x4000.jpg'
 where image_id = '00000000-0000-4000-8000-0000000000e1';
-- An upload slip used or run out.
insert into public.pending_uploads (path, user_id, scope, record_id)
  values (:'p_id' || '/00000000-0000-4000-8000-0000000000d9.pdf', :'staff_id', 'piece', :'p_id');
delete from public.pending_uploads;

do $$
declare
  _p text := current_setting('t.p_id');
  _expected text[] := array[
    'maker-portraits|' || current_setting('t.m_id') || '/display-1.jpg',
    'piece-derivatives|' || _p || '/00000000-0000-4000-8000-0000000000e1.sq-4000x3000.jpg',
    'piece-derivatives|' || _p || '/00000000-0000-4000-8000-0000000000e2.jpg',
    'piece-documents|' || _p || '/00000000-0000-4000-8000-0000000000d1.pdf',
    'piece-documents|' || _p || '/00000000-0000-4000-8000-0000000000d9.pdf',
    'piece-documents|shipments/' || current_setting('t.s_id') || '/00000000-0000-4000-8000-0000000000c1.pdf',
    'piece-originals|' || _p || '/00000000-0000-4000-8000-0000000000f2.heic'];
  _got text[];
begin
  select array_agg(bucket || '|' || path order by bucket || '|' || path) into _got from public.storage_removals;
  select array_agg(x order by x) into _expected from unnest(_expected) x;
  if _got is distinct from _expected then
    raise exception 'queued % , expected %', _got, _expected;
  end if;
end $$;

-- A register move deletes a stock row but keeps everything attached: nothing queued.
select count(*) as before_move from public.storage_removals \gset
select set_config('t.before_move', :'before_move', true);
select t.claims(:'admin_id');
set local role authenticated;
select public.move_piece_ledger(:'p_id', 'external') as moved \gset
reset role;
do $$ begin
  if (select count(*) from public.storage_removals) <> current_setting('t.before_move')::int then
    raise exception 'a register move queued files';
  end if;
end $$;

-- The purge of a trashed work queues its photograph (original, master,
-- square) through the cascade; the maker delete queues the portraits.
update public.external_pieces set deleted_at = now() - interval '31 days' where id = :'p_id';
select public.purge_deleted_pieces() as purged \gset
delete from public.makers where id = :'m_id';
do $$
declare
  _p text := current_setting('t.p_id');
  _m text := current_setting('t.m_id');
begin
  if (select count(*) from public.storage_removals where (bucket, path) in (
        ('piece-originals', _p || '/00000000-0000-4000-8000-0000000000f1.jpg'),
        ('piece-derivatives', _p || '/00000000-0000-4000-8000-0000000000e1.jpg'),
        ('piece-derivatives', _p || '/00000000-0000-4000-8000-0000000000e1.sq-6000x4000.jpg'),
        ('maker-portraits', _m || '/display-2.jpg'),
        ('maker-portraits', _m || '/original-1.jpg'))) <> 5 then
    raise exception 'the purge or the maker delete did not queue every file: %',
      (select array_agg(bucket || '|' || path) from public.storage_removals);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- What the sweep is handed.
-- ---------------------------------------------------------------------------
set local role service_role;
do $$ begin
  if exists (select 1 from public.storage_removals_due('90 days', 100)) then
    raise exception 'files deleted today are already due';
  end if;
end $$;
reset role;

-- Everything waited 40 days; one key is now in use again (a document row
-- restored with the same path).
update public.storage_removals set queued_at = now() - interval '40 days';
insert into public.pieces (title) values ('Restored') returning id as r_id \gset
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (:'r_id', 'other', 'Packing list', 'shipments/' || :'s_id' || '/00000000-0000-4000-8000-0000000000c1.pdf');

set local role service_role;
do $$
declare
  _n integer;
  _total integer := (select count(*) from public.storage_removals);
begin
  -- 40 days is past the 35-day floor but not past the 90 days asked for.
  if exists (select 1 from public.storage_removals_due('90 days', 100, true)) then
    raise exception 'a 90-day wait handed over 40-day-old keys';
  end if;
  -- A wait under the floor is raised to 35 days, which 40 days passes.
  select count(*) into _n from public.storage_removals_due('1 day', 100, true);
  if _n <> _total - 1 then
    raise exception 'due (dry) should give every key but the one in use: % of %', _n, _total;
  end if;
  if exists (select 1 from public.storage_removals_due('1 day', 100, true) where path like 'shipments/%') then
    raise exception 'a key a row points at again was handed over';
  end if;
  if not exists (select 1 from public.storage_removals where path like 'shipments/%') then
    raise exception 'a dry run changed the queue';
  end if;
  -- A real run forgets the key in use.
  select count(*) into _n from public.storage_removals_due('1 day', 3);
  if _n <> 3 then raise exception 'the limit was not applied: %', _n; end if;
  if exists (select 1 from public.storage_removals where path like 'shipments/%') then
    raise exception 'a key in use again was not forgotten';
  end if;
  -- Forgetting what the sweep removed.
  select public.storage_removals_forget('piece-derivatives',
           array(select path from public.storage_removals where bucket = 'piece-derivatives')) into _n;
  -- The square of the first render, the master the worker never wrote,
  -- and the purged photograph's master and square.
  if _n <> 4 or exists (select 1 from public.storage_removals where bucket = 'piece-derivatives') then
    raise exception 'storage_removals_forget removed % rows', _n;
  end if;
end $$;
reset role;

-- A key queued again starts its wait again.
update public.storage_removals set queued_at = now() - interval '100 days';
select public.queue_storage_removal('maker-portraits', :'m_id' || '/display-2.jpg');
do $$ begin
  if (select queued_at from public.storage_removals where path = current_setting('t.m_id') || '/display-2.jpg')
     < now() - interval '1 minute' then
    raise exception 'queueing a key again did not restart its wait';
  end if;
end $$;

-- Signed-in users cannot read or empty the queue.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if t.visible('public.storage_removals') <> -1 then raise exception 'an admin session can read the queue'; end if;
  begin
    perform public.storage_removals_due('90 days', 10);
    raise exception 'an admin session could call storage_removals_due';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
