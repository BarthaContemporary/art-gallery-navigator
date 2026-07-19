-- 0032_storage_role_grants
-- FIX: storage uploads failed for every user (studio + capture) with
-- "new row violates row-level security policy", and storage.objects was empty.
--
-- Root cause: the storage service connects to Postgres as
-- `supabase_storage_admin` and, per request, does `SET ROLE <jwt role>` +
-- sets request.jwt.claims so the RLS policies on storage.objects can evaluate
-- `auth.uid()` / has_any_role(). That SET ROLE only works if
-- `supabase_storage_admin` is a MEMBER of those roles. It wasn't (only
-- `authenticator`, used by REST/GoTrue, had the memberships), so every storage
-- request silently ran as `supabase_storage_admin` — no claims, no bypass —
-- and RLS denied it. This grant is part of the stock Supabase role setup that
-- our bootstrap missed.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_storage_admin') then
    execute 'grant anon, authenticated, service_role to supabase_storage_admin';
  end if;
end;
$$;
