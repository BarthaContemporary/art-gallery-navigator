-- 0099: the image worker's claim on a photograph becomes a lease.
--
-- The worker flips a row from 'pending' to 'processing' before it works on
-- it, and only its own final write (or its error write) moves it on. When
-- the worker stopped in between (a rebuild, a reboot, an out-of-memory kill,
-- a database restart), the row stayed 'processing' for good: the studio
-- showed "Processing…" forever, the website sync skipped the photograph,
-- and only SQL on the server fixed it.
--
-- Now the claim records when it was taken and how often. A row still
-- 'processing' fifteen minutes after its last start is taken again by the
-- next claim; after three tries (a worker that keeps dying on the same
-- image, or a storage error that does not clear) it is marked 'error' with
-- the last message, and a person's retry (setting it back to 'pending')
-- starts the count again. The worker also uses the lease to retry a
-- passing storage or network failure a few minutes later, within the same
-- three tries, instead of failing the photograph at once.
--
-- The worker (infra/image-worker) runs without this migration exactly as
-- before; it uses claim_piece_images() once this is applied (and the worker
-- restarted, docs/ops/security-runbook.md step 10).
--
-- Triggers: setting 'processing' or a later start time does not re-sync the
-- website (0086 skips 'pending'/'processing') and wakes nobody (0054 fires
-- on 'pending' only); giving up writes 'error', which syncs as a worker
-- error always has.

alter table public.piece_images
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts integer not null default 0;

comment on column public.piece_images.processing_started_at is
  'When the image worker last started on this row (its lease); set by claim_piece_images()';
comment on column public.piece_images.processing_attempts is
  'Image worker tries since the row was last set to pending; at the limit it is marked error';

create index if not exists idx_piece_images_processing
  on public.piece_images (processing_started_at)
  where processing_status = 'processing';

-- Claim up to _limit rows: every 'pending' row, and every 'processing' row
-- whose lease (_lease_seconds since its start) has run out. Rows that ran
-- out _max_attempts times are marked 'error' instead. SKIP LOCKED keeps two
-- workers off the same row. Runs as the caller (the image_worker role, whose
-- table grant and BYPASSRLS, 0051, are what it needs).
create or replace function public.claim_piece_images(
  _limit integer,
  _lease_seconds integer default 900,
  _max_attempts integer default 3
)
returns table (
  id uuid,
  piece_id uuid,
  storage_path_original text,
  rotation smallint,
  processing_attempts integer
)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
begin
  update public.piece_images pi
     set processing_status = 'error',
         processing_error  = left(format('Gave up after %s tries: %s', pi.processing_attempts,
                                         coalesce(pi.processing_error, 'the image worker stopped while processing it')), 2000)
   where pi.processing_status = 'processing'
     and pi.processing_attempts >= _max_attempts
     and (pi.processing_started_at is null
          or pi.processing_started_at < now() - make_interval(secs => _lease_seconds));

  return query
  update public.piece_images pi
     set processing_status     = 'processing',
         processing_started_at = now(),
         -- A row a person (or the worker's own shutdown) put back to
         -- 'pending' starts a fresh count; a lease that ran out adds a try.
         processing_attempts   = case when pi.processing_status = 'pending' then 1
                                      else pi.processing_attempts + 1 end
   where pi.id in (
           select c.id
             from public.piece_images c
            where c.processing_status = 'pending'
               or (c.processing_status = 'processing'
                   and c.processing_attempts < _max_attempts
                   and (c.processing_started_at is null
                        or c.processing_started_at < now() - make_interval(secs => _lease_seconds)))
            order by c.id
            limit greatest(_limit, 0)
              for update skip locked
         )
  returning pi.id, pi.piece_id, pi.storage_path_original, pi.rotation, pi.processing_attempts;
end;
$$;

revoke execute on function public.claim_piece_images(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_piece_images(integer, integer, integer) to image_worker;

notify pgrst, 'reload schema';
