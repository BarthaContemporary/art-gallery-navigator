-- 0099: claim_piece_images() takes pending rows and rows whose lease ran
-- out, gives up after the tries allowed, starts a fresh count for a row a
-- person re-queued, and only the image worker may call it. The worker's
-- other lease writes (renew, retry later, hand back) work as that role, and
-- none of it re-syncs the website.
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
  n int; att int; started timestamptz;
  a uuid := current_setting('t.a')::uuid; b uuid := current_setting('t.b')::uuid;
  c uuid := current_setting('t.c')::uuid; d uuid := current_setting('t.d')::uuid;
begin
  -- 1. The pending rows and the stranded one, each on try 1 or 2.
  select count(*) into n from public.claim_piece_images(10);
  if n <> 3 then raise exception 'first claim took % rows, expected 3', n; end if;
  select processing_attempts into att from public.piece_images where id = a;
  if att <> 1 then raise exception 'pending row claimed as try %', att; end if;
  select processing_attempts into att from public.piece_images where id = c;
  if att <> 1 then raise exception 'stranded row claimed as try %', att; end if;
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

  -- 3. The worker renews a lease when it starts an image, and schedules a
  --    retry by moving the start back (as worker.ts does).
  update public.piece_images set processing_started_at = now() where id = a and processing_status = 'processing';
  update public.piece_images
     set processing_started_at = now() - make_interval(secs => 900) - interval '1 second',
         processing_error = 'upload failed: storage busy'
   where id = b and processing_status = 'processing';

  -- 4. A run-out lease is taken again as the next try.
  select count(*) into n from public.claim_piece_images(10);
  if n <> 1 then raise exception 'run-out lease: claimed % rows, expected 1', n; end if;
  select processing_attempts into att from public.piece_images where id = b;
  if att <> 2 then raise exception 'reclaimed row on try %, expected 2', att; end if;
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
  -- 5. Out of tries: marked error with the last message, not claimed.
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

  -- 6. A person's retry (back to pending) starts a fresh count.
  update public.piece_images set processing_status = 'pending', processing_error = null where id = b;
  select count(*) into n from public.claim_piece_images(10);
  if n <> 1 then raise exception 're-queued row not claimed'; end if;
  select processing_attempts into att from public.piece_images where id = b;
  if att <> 1 then raise exception 're-queued row claimed as try %', att; end if;

  -- 7. Shutdown hands unstarted rows back.
  update public.piece_images set processing_status = 'pending'
   where id = any(array[a, c]) and processing_status = 'processing';
  if (select count(*) from public.piece_images where id in (a, c) and processing_status = 'pending') <> 2 then
    raise exception 'rows not handed back';
  end if;

  -- 8. The limit is honoured.
  select count(*) into n from public.claim_piece_images(1);
  if n <> 1 then raise exception 'limit 1 claimed % rows', n; end if;
end $$;
reset role;
rollback;
