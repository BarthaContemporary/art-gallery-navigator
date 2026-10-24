-- Helpers for the harness tests: make users with roles and act as them the
-- way PostgREST does (role + request.jwt.claims). Include with
--   \ir ../lib/helpers.sql
-- at the top of a test, run as the superuser.
create schema if not exists t;
grant usage on schema t to anon, authenticated, service_role;

-- A user with the given role (or none), returning its id.
create or replace function t.make_user(_email text, _role public.user_role default null)
returns uuid language plpgsql as $$
declare _id uuid;
begin
  insert into auth.users (email) values (_email) returning id into _id;
  if _role is not null then
    insert into public.user_roles (user_id, role) values (_id, _role);
  end if;
  return _id;
end $$;

-- Act as a signed-in user for the rest of the transaction: call, then
-- `set local role authenticated`.
create or replace function t.claims(_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', _id, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- Rows of a table the current role can see: -1 when it may not select at
-- all (no grant), which is as good as none.
create or replace function t.visible(_table regclass) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from %s', _table) into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;
grant execute on function t.visible(regclass) to anon, authenticated, service_role;
