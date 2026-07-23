-- 0051: least-privilege DB role for the image-worker.
--
-- The worker parses untrusted image bytes (sharp/libvips + heic-convert WASM);
-- it previously connected as the `postgres` superuser. Give it only what it
-- needs: claim pending rows and write derivative metadata on piece_images,
-- and LISTEN for the notify signal.
--
-- DEPLOY (coordinated — do NOT apply in isolation):
--   1. Set a strong password:  \set pw '...'  then run this file with it, or
--      after applying:  alter role image_worker with password 'STRONG';
--   2. Put the same value in compose/.env as IMAGE_WORKER_DB_PASSWORD.
--   3. Rebuild/restart the worker (its DATABASE_URL now uses this role).
-- Until step 3 the running worker keeps using its old connection string, so
-- creating the role early is harmless.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'image_worker') then
    create role image_worker with login password 'CHANGE_ME_SET_AT_DEPLOY';
  end if;
end
$$;

grant connect on database postgres to image_worker;
grant usage on schema public to image_worker;
grant select, update on table public.piece_images to image_worker;

-- No access to financials, CRM, auth, or storage tables.
revoke all on table public.piece_financials from image_worker;

notify pgrst, 'reload schema';
