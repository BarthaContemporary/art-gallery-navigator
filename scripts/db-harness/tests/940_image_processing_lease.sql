-- 0099: claim_piece_images() takes pending rows and rows whose lease ran
-- out, counts no try itself (the worker counts one when it starts an
-- image), so a row claimed but never started never runs out of tries,
-- gives up on a row started the tries allowed, starts a fresh count for a
-- row a person re-queued, and only the image worker may call it. The
-- worker's other lease writes (start, retry later, hand back) work as that
-- role, and none of it re-syncs the website.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset
insert into public.pieces (title, web_visible) values ('Leased work', true) returning id as piece_id \gset

insert into public.piece_images (piece_id, storage_path_original, processing_status)
values (:'piece_id', :'piece_id' || '/a.jpg', 'pending') returning id as a \gset
insert into public.piece_images (piece_id, storage_path_original, processing_status)
values (:'piece_id', :'piece_id' || '/b.jpg', 'pending') returning id as b \gset
-- Stranded by a worker that died before 0099 (no start time).
insert into public.piece_images (piece_id, storage_path_original, processing_status)
values (:'piece_id', :'piece_id' || '/c.jpg', 'processing') returning id as c \gset
-- Done rows are never claimed.
insert into public.piece_images (piece_id, storage_path_original, processing_status)
values (:'piece_id', :'piece_id' || '/d.jpg', 'done') returning id as d \gset

select set_config('t.a', :'a', true), set_config('t.b', :'b', true),
       set_config('t.c', :'c', true), set_config('t.d', :'d', true);

-- Only the image worker may call it.
select t.claims(:'staff_id');
set local role authenticated;
do $$
begin
  perform * from public.claim_piece_images(10);
  raise exception 'authenticated could claim images';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role anon;
do $$
begin
  perform * from public.claim_piece_images(10);
  raise exception 'anon could claim images';
exception when insufficient_privilege then null;
end $$;
reset role;

select set_config('t.outbox', (select count(*) from public.sync_outbox)::text, true);

set local role image_worker;
do $$
declare
  n int; att int;
  a uuid := current_setting('t.a')::uuid; b uuid := current_setting('t.b')::uuid;
  c uuid := current_setting('t.c')::uuid; d uuid := current_setting('t.d')::uuid;
begin
  -- 1. The pending rows and the stranded one. The claim counts no try:
  --    a try counts when the worker starts on the image.
  select count(*) into n from public.claim_piece_images(10);
  if n <> 3 then raise exception 'first claim took % rows, expected 3', n; end if;
  if exists (select 1 from public.piece_images where id in (a, b, c) and processing_attempts <> 0) then
    raise exception 'the claim counted a try';
  end if;
  if (select processing_status from public.piece_images where id = d) <> 'done' then
    raise exception 'a done row was claimed';
  end if;
  if exists (select 1 from public.piece_images where id in (a, b, c)
             and (processing_status <> 'processing' or processing_started_at is null)) then
    raise exception 'claimed rows not marked processing with a start time';
  end if;

  -- 2. A live lease is not taken again.
  select count(*) into n from public.claim_piece_images(10);
  if n <> 0 then raise exception 'live leases were re-claimed (% rows)', n; end if;

  -- 3. The worker starts a and b (startAttempt in worker.ts: count the try,
  --    renew the lease, one write), then schedules a retry of b by moving
  --    its start back. c stays claimed but never started (the worker died
  --    on another image first) until its lease runs out.
  update public.piece_images
     set processing_started_at = now(), processing_attempts = processing_attempts + 1
   where id = a and processing_status = 'processing'
  returning processing_attempts into att;
  if att <> 1 then raise exception 'first start of a counted as try %', att; end if;
  update public.piece_images
     set processing_started_at = now(), processing_attempts = processing_attempts + 1
   where id = b and processing_status = 'processing';
  update public.piece_images
     set processing_started_at = now() - make_interval(secs => 900) - interval '1 second',
         processing_error = 'upload failed: storage busy'
   where id = b and processing_status = 'processing';
  update public.piece_images set processing_started_at = now() - interval '1 hour' where id = c;

  -- 4. Run-out leases are taken again, keeping their count: b was tried
  --    once, c never.
  select count(*) into n from public.claim_piece_images(10);
  if n <> 2 then raise exception 'run-out leases: claimed % rows, expected 2', n; end if;
  select processing_attempts into att from public.piece_images where id = b;
  if att <> 1 then raise exception 'reclaimed row b has % tries, expected 1', att; end if;
  select processing_attempts into att from public.piece_images where id = c;
  if att <> 0 then raise exception 'never-started row c has % tries, expected 0', att; end if;

  -- 5. A row claimed beside an image that keeps killing the worker, and
  --    never started, is not given up however often its lease runs out.
  for i in 1..5 loop
    update public.piece_images set processing_started_at = now() - interval '1 hour' where id = c;
    select count(*) into n from public.claim_piece_images(10) x where x.id = c;
    if n <> 1 then raise exception 'never-started row c not reclaimed on round %', i; end if;
  end loop;
  if (select processing_status from public.piece_images where id = c) <> 'processing'
     or (select processing_attempts from public.piece_images where id = c) <> 0 then
    raise exception 'never-started row c lost tries or was given up';
  end if;
end $$;
reset role;

-- Claiming, renewing and retrying never touched the website queue (0086).
do $$
begin
  if (select count(*) from public.sync_outbox) <> current_setting('t.outbox')::bigint then
    raise exception 'lease writes queued a website sync';
  end if;
end $$;

set local role image_worker;
do $$
declare
  n int; att int;
  a uuid := current_setting('t.a')::uuid; b uuid := current_setting('t.b')::uuid;
  c uuid := current_setting('t.c')::uuid;
begin
  -- 6. Out of tries: started three times, the last lease run out (the
  --    worker died on it again): marked error with the last message, not
  --    claimed.
  update public.piece_images set processing_attempts = 3,
         processing_started_at = now() - interval '1 hour' where id = b;
  select count(*) into n from public.claim_piece_images(10);
  if n <> 0 then raise exception 'a row out of tries was claimed'; end if;
  if (select processing_status from public.piece_images where id = b) <> 'error' then
    raise exception 'a row out of tries was not marked error';
  end if;
  if (select processing_error from public.piece_images where id = b) not like 'Gave up after 3 tries: upload failed%' then
    raise exception 'unexpected give-up message: %', (select processing_error from public.piece_images where id = b);
  end if;

  -- 7. A person's retry (back to pending) starts a fresh count.
  update public.piece_images set processing_status = 'pending', processing_error = null where id = b;
  select count(*) into n from public.claim_piece_images(10);
  if n <> 1 then raise exception 're-queued row not claimed'; end if;
  select processing_attempts into att from public.piece_images where id = b;
  if att <> 0 then raise exception 're-queued row claimed with % tries', att; end if;

  -- 8. Shutdown hands unstarted rows back.
  update public.piece_images set processing_status = 'pending'
   where id = any(array[a, c]) and processing_status = 'processing';
  if (select count(*) from public.piece_images where id in (a, c) and processing_status = 'pending') <> 2 then
    raise exception 'rows not handed back';
  end if;

  -- 9. The limit is honoured.
  select count(*) into n from public.claim_piece_images(1);
  if n <> 1 then raise exception 'limit 1 claimed % rows', n; end if;
end $$;
reset role;
rollback;
