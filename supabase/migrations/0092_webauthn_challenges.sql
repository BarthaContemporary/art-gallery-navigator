-- 0092_webauthn_challenges
-- Passkey challenges are kept on the server (security review 2026-10,
-- finding F7). Until now the challenge travelled in a cookie and the verify
-- routes checked the browser's answer against whatever that cookie said, so
-- a passkey answer captured once could be replayed later with a matching
-- cookie, and an enrolment challenge was not tied to anyone.
--
-- Now the *-options routes of both apps record each challenge here (which
-- app, what for, for an enrolment the signed-in user, five minutes to live)
-- and the browser gets only the row's random id, in an HttpOnly cookie. The
-- *-verify routes take the row out in one statement, so a challenge works
-- once, before it expires, for its own app and purpose and (enrolment) for
-- its own user. Expired rows are cleared whenever a new one is issued.
--
-- Only the service role may touch it: the routes call these functions from
-- server code. A row holds a staff user id for five minutes at most (ROPA 11,
-- staff accounts and login events) and is cleared by the functions
-- themselves, so it needs no retention_policies entry of its own.
--
-- Also (finding F20): signed-in users could insert or rewrite their own
-- capture passkey rows straight through the REST API (the policies allowed
-- every command), which would skip the server's registration checks and the
-- new recent-sign-in rule. Users and admins keep reading and removing
-- passkeys; only the server, with the service role, adds or changes them.

create table if not exists public.webauthn_challenges (
  id          uuid primary key default gen_random_uuid(),
  app         text not null check (app in ('studio', 'capture')),
  purpose     text not null check (purpose in ('register', 'login')),
  challenge   text not null check (length(challenge) between 16 and 512),
  user_id     uuid references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '5 minutes',
  -- An enrolment challenge belongs to the user who asked for it.
  constraint webauthn_challenges_register_user check (purpose <> 'register' or user_id is not null)
);
create index if not exists webauthn_challenges_expires_at on public.webauthn_challenges (expires_at);

alter table public.webauthn_challenges enable row level security;
revoke all on public.webauthn_challenges from public, anon, authenticated;
grant select, insert, delete on public.webauthn_challenges to service_role;

comment on table public.webauthn_challenges is
  'Passkey challenges between the options and verify calls; single use, five minutes. Service role only.';

-- Record a challenge and return its id (the only part the browser sees).
create or replace function public.webauthn_challenge_issue(
  _app text, _purpose text, _challenge text, _user_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  _id uuid;
begin
  -- An expired challenge can no longer be used; clear them as new ones come.
  delete from public.webauthn_challenges where expires_at <= now();
  insert into public.webauthn_challenges (app, purpose, challenge, user_id)
  values (_app, _purpose, _challenge, _user_id)
  returning id into _id;
  return _id;
end;
$$;

-- Take a challenge out and return it, or null when it is missing, expired,
-- issued by the other app or for the other purpose, or (enrolment) issued
-- to someone else. The row goes either way: one attempt per challenge.
create or replace function public.webauthn_challenge_take(
  _id uuid, _app text, _purpose text, _user_id uuid default null)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  _row public.webauthn_challenges;
begin
  delete from public.webauthn_challenges where id = _id returning * into _row;
  if not found then
    return null;
  end if;
  if _row.expires_at <= now()
     or _row.app is distinct from _app
     or _row.purpose is distinct from _purpose
     or (_row.purpose = 'register' and _row.user_id is distinct from _user_id) then
    return null;
  end if;
  return _row.challenge;
end;
$$;

revoke all on function public.webauthn_challenge_issue(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.webauthn_challenge_take(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.webauthn_challenge_issue(text, text, text, uuid) to service_role;
grant execute on function public.webauthn_challenge_take(uuid, text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Capture passkeys (public.passkeys): read and remove only.
-- ---------------------------------------------------------------------------
drop policy if exists passkeys_self on public.passkeys;
drop policy if exists passkeys_admin on public.passkeys;

drop policy if exists passkeys_self_read on public.passkeys;
create policy passkeys_self_read on public.passkeys
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists passkeys_self_delete on public.passkeys;
create policy passkeys_self_delete on public.passkeys
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists passkeys_admin_read on public.passkeys;
create policy passkeys_admin_read on public.passkeys
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists passkeys_admin_delete on public.passkeys;
create policy passkeys_admin_delete on public.passkeys
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.passkeys from public, anon, authenticated;
grant select, delete on public.passkeys to authenticated;
grant all on public.passkeys to service_role;

-- Studio passkeys (webauthn_credentials) were already closed by RLS with no
-- policies; drop the unused table grants too, so it reads as what it is.
revoke all on public.webauthn_credentials from public, anon, authenticated;
grant all on public.webauthn_credentials to service_role;

notify pgrst, 'reload schema';
