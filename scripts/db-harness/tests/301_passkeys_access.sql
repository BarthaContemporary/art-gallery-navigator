-- 0092: capture passkeys (public.passkeys) can be read and removed by their
-- owner and by an admin, but only the server adds or changes them (no
-- enrolment around its checks); studio passkeys (webauthn_credentials) are
-- the server's alone.
\ir ../lib/helpers.sql
begin;
select t.make_user('pk.staff@example.com', 'staff') as staff_id \gset
select t.make_user('pk.other@example.com', 'staff') as other_id \gset
select t.make_user('pk.admin@example.com', 'admin') as admin_id \gset

-- The server (service role) enrols and updates passkeys in both apps.
set local role service_role;
insert into public.passkeys (id, user_id, public_key) values
  ('cred-staff-1', :'staff_id', 'key-1'),
  ('cred-staff-2', :'staff_id', 'key-2'),
  ('cred-other-1', :'other_id', 'key-3');
update public.passkeys set counter = 1, last_used_at = now() where id = 'cred-staff-1';
insert into public.webauthn_credentials (user_id, credential_id, public_key)
values (:'staff_id', 'studio-cred-1', 'key-4');
do $$ begin
  if (select count(*) from public.webauthn_credentials) <> 1 then raise exception 'service role should see studio passkeys'; end if;
end $$;
reset role;

-- No policy still allows writing.
do $$ begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'passkeys'
              and cmd in ('ALL', 'INSERT', 'UPDATE')) then
    raise exception 'a passkeys policy still allows inserts or updates';
  end if;
end $$;

-- A staff user sees and removes their own passkeys, nobody else's, and
-- cannot add or rewrite one directly.
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.passkeys) <> 2 then raise exception 'staff should see their own two passkeys only'; end if;
  begin
    insert into public.passkeys (id, user_id, public_key) values ('forged', auth.uid(), 'attacker-key');
    raise exception 'staff could insert a passkey directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.passkeys set public_key = 'attacker-key' where id = 'cred-staff-1';
    raise exception 'staff could rewrite a passkey';
  exception when insufficient_privilege then null;
  end;
  delete from public.passkeys where id = 'cred-other-1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'staff removed another user''s passkey'; end if;
  delete from public.passkeys where id = 'cred-staff-2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'staff should be able to remove their own passkey'; end if;
  if t.visible('public.webauthn_credentials') >= 0 then raise exception 'staff can read studio passkeys'; end if;
end $$;
reset role;

-- An admin sees and removes anyone's, but cannot add one either.
select t.claims(:'admin_id');
set local role authenticated;
do $$
declare n integer;
begin
  if (select count(*) from public.passkeys) <> 2 then raise exception 'admin should see every remaining passkey'; end if;
  begin
    insert into public.passkeys (id, user_id, public_key)
    values ('forged-admin', (select user_id from public.passkeys where id = 'cred-other-1'), 'attacker-key');
    raise exception 'admin could insert a passkey for another user';
  exception when insufficient_privilege then null;
  end;
  delete from public.passkeys where id = 'cred-other-1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin should be able to remove any passkey'; end if;
  if t.visible('public.webauthn_credentials') >= 0 then raise exception 'admin can read studio passkeys through the API'; end if;
end $$;
reset role;

-- Anonymous callers get nothing.
set local role anon;
do $$ begin
  if t.visible('public.passkeys') >= 0 then raise exception 'anon can read capture passkeys'; end if;
  if t.visible('public.webauthn_credentials') >= 0 then raise exception 'anon can read studio passkeys'; end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.passkeys) <> 1 then raise exception 'exactly cred-staff-1 should remain'; end if;
end $$;
rollback;
