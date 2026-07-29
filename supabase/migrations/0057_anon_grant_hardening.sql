-- 0057_anon_grant_hardening
--
-- 0012_rls.sql revoked anon's table privileges once, at a moment in time:
--
--     revoke all on all tables in schema public from anon;
--
-- That statement only touches tables that existed when it ran. Every table
-- created since (shipments, capture_*, passkeys, webauthn_credentials,
-- backup_runs, the ledger tables, …) picked up Supabase's default grants to
-- anon again — 24 of them at the time of writing. RLS saved all but one:
-- external_stock_number_counters was created without RLS enabled, so the
-- anon key (which ships to every browser in the studio bundle) could read,
-- rewrite or truncate the external stock-number sequence.
--
-- This migration closes the hole and removes the recurrence: default
-- privileges are altered so tables created from here on never grant anon
-- anything in the first place.

-- ---------------------------------------------------------------------------
-- 1. The actual exposure: a counter table with no RLS.
-- ---------------------------------------------------------------------------
alter table public.external_stock_number_counters enable row level security;

-- Matches stock_number_counters: no policy for staff, admin-only, and the
-- SECURITY DEFINER allocator functions bypass RLS regardless.
drop policy if exists admin_all on public.external_stock_number_counters;
create policy admin_all on public.external_stock_number_counters
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Sweep every current table/view/sequence clean of anon privileges.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- ---------------------------------------------------------------------------
-- 3. Stop it coming back. Default privileges apply to objects created later,
--    which is precisely what the one-shot revoke in 0012 could not do.
--    Both creating roles are covered: migrations run as supabase_admin via
--    postgres-meta, the Supabase CLI applies them as postgres.
-- ---------------------------------------------------------------------------
do $$
declare
  r text;
begin
  foreach r in array array['postgres', 'supabase_admin']
  loop
    execute format(
      'alter default privileges for role %I in schema public revoke all on tables from anon', r);
    execute format(
      'alter default privileges for role %I in schema public revoke all on sequences from anon', r);
    execute format(
      'alter default privileges for role %I in schema public revoke all on functions from anon', r);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. A standing check, so this is visible rather than rediscovered.
--    Any row returned is a table reachable without authentication.
-- ---------------------------------------------------------------------------
create or replace view public.vw_anon_exposure as
select
  c.relname                                    as table_name,
  c.relrowsecurity                             as rls_enabled,
  string_agg(distinct tp.privilege_type, ', ') as anon_privileges
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join information_schema.table_privileges tp
  on tp.table_schema = n.nspname
 and tp.table_name   = c.relname
 and tp.grantee      = 'anon'
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
group by c.relname, c.relrowsecurity;

comment on view public.vw_anon_exposure is
  'Tables in public that still grant privileges to anon. Should be empty. '
  'A row with rls_enabled = false is reachable by anyone holding the '
  'publishable anon key.';

revoke all on public.vw_anon_exposure from anon;
grant select on public.vw_anon_exposure to authenticated;

notify pgrst, 'reload schema';
