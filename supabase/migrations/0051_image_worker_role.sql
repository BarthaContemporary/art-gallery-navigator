-- 0051: least-privilege DB role for the image-worker.
--
-- The worker parses untrusted image bytes (sharp/libvips + heic-convert WASM);
-- it previously connected as the `postgres` superuser. Give it only what it
-- needs: claim pending rows and write derivative metadata on piece_images,
-- and LISTEN for the notify signal.
--
-- DEPLOY (coordinated — do NOT apply in isolation):
--   1. Enable login with a strong password (the role ships NOLOGIN / no
--      password so a fresh apply can't be abused):
--        alter role image_worker with password 'STRONG' login;
--   2. Put the same value in compose/.env as IMAGE_WORKER_DB_PASSWORD.
--   3. Rebuild/restart the worker (its DATABASE_URL now uses this role).
-- Until step 3 the running worker keeps using its old connection string, so
-- creating the role early is harmless.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'image_worker') then
    -- Fail closed: no password and NOLOGIN, so the role cannot authenticate
    -- until the deploy sets a strong password and enables login:
    --   alter role image_worker with password '<strong>' login;
    -- (Never ship a usable placeholder credential.) An existing role — e.g.
    -- one already configured on the live box — is left untouched.
    create role image_worker with nologin;
  end if;
end
$$;

grant connect on database postgres to image_worker;
grant usage on schema public to image_worker;
grant select, update on table public.piece_images to image_worker;

-- No access to financials, CRM, auth, or storage tables.
revoke all on table public.piece_financials from image_worker;

-- piece_images has RLS enabled; the worker is a trusted background process
-- (the old worker ran as the postgres superuser, which bypasses RLS). Its
-- table grants are already limited to SELECT/UPDATE on piece_images only, so
-- BYPASSRLS here is appropriately scoped — without it the worker sees zero
-- pending rows and silently processes nothing.
alter role image_worker bypassrls;

notify pgrst, 'reload schema';
