-- 0090_storage_path_guards
-- Storage paths kept in the database, and the document uploads recorded
-- against them (security review 2026-10, findings F2 and F6).
--
-- F6. Server routes, the website sync and the image worker read a storage
-- path from a row and hand it to a service-role storage call. The storage
-- client joins the path into a URL, and URL parsing collapses ".." segments,
-- so a staff user who set piece_images.storage_path_display to
-- "<piece>/../../piece-documents/<invoice>" could have the service role read
-- (and publish, or overwrite) an object from a bucket they may not see. The
-- apps now check every such path before using it; the triggers below keep
-- signed-in users from writing one in the first place. They hold new values
-- to the shapes the apps themselves write:
--   piece_images.storage_path_original   <piece>/<uuid>.<ext>        (studio uploader)
--   piece_images.storage_path_display    <piece>/<image>.jpg         (image worker)
--   makers.portrait_path                 <maker>/display-<n>.jpg     (portrait route)
--   makers.portrait_original_path        <maker>/original-<n>.<ext>  (portrait route)
--   capture_photos.storage_path          works/<batch>/<work>/<uuid>.<ext>
--   capture_invoice_pages.storage_path,
--   capture_invoice_pages.squared_path   invoices/<invoice>/<uuid>.<ext>
-- Only requests made as a signed-in user (or anon) are checked. The service
-- role, the image worker and migrations write these columns from their own
-- code, which builds the paths from row ids. A trigger rather than a CHECK
-- constraint: it judges only the values being written, so an older row in
-- another shape still loads and saves when other columns change.
--
-- F2. /api/files/commit used to delete the object it was given whenever the
-- row insert failed, with the service role, so any signed-in user could
-- point it at an existing invoice file and destroy it. Now /api/files/sign
-- records each path it issues in pending_uploads (who, which record, until
-- when), and commit must claim that record, once, before it may insert a row
-- or remove a file. Service role only; rows live three hours at most and are
-- swept whenever a new upload is issued, so the table needs no retention
-- entry (it holds a staff user id and a random object key, nothing else).

-- ---- F2: uploads issued and not yet recorded -------------------------------
create table if not exists public.pending_uploads (
  path        text primary key,   -- object key in the piece-documents bucket
  user_id     uuid not null references auth.users (id) on delete cascade,
  scope       text not null check (scope in ('shipment', 'piece', 'document')),
  record_id   uuid,               -- the shipment or work; null for a shared document
  -- A signed upload URL lasts two hours; the extra hour covers a slow upload
  -- finishing just before its URL runs out.
  expires_at  timestamptz not null default now() + interval '3 hours'
);
create index if not exists pending_uploads_expires_at on public.pending_uploads (expires_at);

alter table public.pending_uploads enable row level security;
revoke all on public.pending_uploads from public, anon, authenticated;
grant all on public.pending_uploads to service_role;

comment on table public.pending_uploads is
  'Document upload paths issued by /api/files/sign and not yet recorded by /api/files/commit. Service role only; three hours at most.';

-- Record an issued upload path (and sweep the ones that ran out).
create or replace function public.pending_upload_issue(_user uuid, _path text, _scope text, _record uuid)
returns void
language sql
set search_path = public
as $$
  delete from public.pending_uploads where expires_at < now();
  insert into public.pending_uploads (path, user_id, scope, record_id)
  values (_path, _user, _scope, _record);
$$;

-- Claim an issued path for recording: true once, for the user it was issued
-- to and the record it was issued for, before it runs out; false otherwise.
create or replace function public.pending_upload_claim(_user uuid, _path text, _scope text, _record uuid)
returns boolean
language sql
set search_path = public
as $$
  with claimed as (
    delete from public.pending_uploads
     where path = _path
       and user_id = _user
       and scope = _scope
       and record_id is not distinct from _record
       and expires_at > now()
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.pending_upload_issue(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.pending_upload_claim(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.pending_upload_issue(uuid, text, text, uuid) to service_role;
grant execute on function public.pending_upload_claim(uuid, text, text, uuid) to service_role;

-- ---- F6: path shapes for signed-in writers ---------------------------------
-- Each guard returns early unless the writer is a signed-in user or anon:
-- PostgREST switches to those roles for a user's request, while the service
-- role, the image worker and migrations keep their own role names.

create or replace function public.guard_piece_image_paths()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  -- An image moved to another work must have paths under that work.
  _moved boolean := tg_op = 'UPDATE' and new.piece_id is distinct from old.piece_id;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.storage_path_original is not null
     and (tg_op = 'INSERT' or _moved or new.storage_path_original is distinct from old.storage_path_original)
     and new.storage_path_original !~ ('^' || new.piece_id || '/' || _uuid || '\.[a-z0-9]+$') then
    raise exception 'storage_path_original must be <piece id>/<uuid>.<ext> under the image''s own work'
      using errcode = 'check_violation';
  end if;
  if new.storage_path_display is not null
     and (tg_op = 'INSERT' or _moved or new.storage_path_display is distinct from old.storage_path_display)
     and new.storage_path_display !~ ('^' || new.piece_id || '/' || new.id || '\.jpg$') then
    raise exception 'storage_path_display must be <piece id>/<image id>.jpg'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_piece_images_path_guard on public.piece_images;
create trigger trg_piece_images_path_guard
  before insert or update on public.piece_images
  for each row execute function public.guard_piece_image_paths();

create or replace function public.guard_maker_portrait_paths()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if new.portrait_path is not null
     and (tg_op = 'INSERT' or new.portrait_path is distinct from old.portrait_path)
     and new.portrait_path !~ ('^' || new.id || '/display-[0-9]+\.jpg$') then
    raise exception 'portrait_path must be <maker id>/display-<n>.jpg'
      using errcode = 'check_violation';
  end if;
  if new.portrait_original_path is not null
     and (tg_op = 'INSERT' or new.portrait_original_path is distinct from old.portrait_original_path)
     and new.portrait_original_path !~ ('^' || new.id || '/original-[0-9]+\.[a-z0-9]+$') then
    raise exception 'portrait_original_path must be <maker id>/original-<n>.<ext>'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_makers_portrait_path_guard on public.makers;
create trigger trg_makers_portrait_path_guard
  before insert or update on public.makers
  for each row execute function public.guard_maker_portrait_paths();

create or replace function public.guard_capture_photo_paths()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT'
     or new.storage_path is distinct from old.storage_path
     or new.work_id is distinct from old.work_id then
    -- The capture upload route names photos works/<batch>/<work>/<uuid>.<ext>.
    if new.storage_path !~ ('^works/' || _uuid || '/' || coalesce(new.work_id::text, _uuid) || '/' || _uuid || '\.[a-z0-9]+$') then
      raise exception 'storage_path must be works/<batch id>/<work id>/<uuid>.<ext>'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_photos_path_guard on public.capture_photos;
create trigger trg_capture_photos_path_guard
  before insert or update on public.capture_photos
  for each row execute function public.guard_capture_photo_paths();

create or replace function public.guard_capture_invoice_page_paths()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _uuid constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  _moved boolean := tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id;
  _shape text;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  -- The capture upload route names invoice pages invoices/<invoice>/<uuid>.<ext>,
  -- the squared-up copy included.
  _shape := '^invoices/' || new.invoice_id || '/' || _uuid || '\.[a-z0-9]+$';
  if (tg_op = 'INSERT' or _moved or new.storage_path is distinct from old.storage_path)
     and new.storage_path !~ _shape then
    raise exception 'storage_path must be invoices/<invoice id>/<uuid>.<ext>'
      using errcode = 'check_violation';
  end if;
  if new.squared_path is not null
     and (tg_op = 'INSERT' or _moved or new.squared_path is distinct from old.squared_path)
     and new.squared_path !~ _shape then
    raise exception 'squared_path must be invoices/<invoice id>/<uuid>.<ext>'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_invoice_pages_path_guard on public.capture_invoice_pages;
create trigger trg_capture_invoice_pages_path_guard
  before insert or update on public.capture_invoice_pages
  for each row execute function public.guard_capture_invoice_page_paths();

notify pgrst, 'reload schema';
