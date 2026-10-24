-- 0092: passkey challenges live on the server, work once, for five minutes,
-- for their own app and purpose and (enrolment) their own user; only the
-- service role may issue, take or read them.
\ir ../lib/helpers.sql
begin;
select t.make_user('pk.a@example.com', 'staff') as a_id \gset
select t.make_user('pk.b@example.com', 'staff') as b_id \gset

-- The apps' server code (service role) issues and takes challenges.
set local role service_role;
do $$
declare
  _a  uuid := (select id from auth.users where email = 'pk.a@example.com');
  _b  uuid := (select id from auth.users where email = 'pk.b@example.com');
  _c  text := 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
  _id uuid;
begin
  -- A sign-in challenge works once.
  _id := public.webauthn_challenge_issue('studio', 'login', _c);
  if public.webauthn_challenge_take(_id, 'studio', 'login') is distinct from _c then
    raise exception 'a fresh sign-in challenge should be returned';
  end if;
  if public.webauthn_challenge_take(_id, 'studio', 'login') is not null then
    raise exception 'a challenge must not work twice (replay)';
  end if;

  -- The wrong purpose or the other app is refused, and uses the challenge up.
  _id := public.webauthn_challenge_issue('studio', 'login', _c);
  if public.webauthn_challenge_take(_id, 'studio', 'register', _a) is not null then
    raise exception 'a sign-in challenge must not serve an enrolment';
  end if;
  if public.webauthn_challenge_take(_id, 'studio', 'login') is not null then
    raise exception 'a refused challenge must be used up';
  end if;
  _id := public.webauthn_challenge_issue('capture', 'login', _c);
  if public.webauthn_challenge_take(_id, 'studio', 'login') is not null then
    raise exception 'a capture challenge must not work in the studio';
  end if;

  -- An enrolment challenge belongs to the user who asked for it.
  _id := public.webauthn_challenge_issue('capture', 'register', _c, _a);
  if public.webauthn_challenge_take(_id, 'capture', 'register', _b) is not null then
    raise exception 'another user must not use an enrolment challenge';
  end if;
  _id := public.webauthn_challenge_issue('capture', 'register', _c, _a);
  if public.webauthn_challenge_take(_id, 'capture', 'register') is not null then
    raise exception 'an enrolment challenge must not be taken without its user';
  end if;
  _id := public.webauthn_challenge_issue('studio', 'register', _c, _a);
  if public.webauthn_challenge_take(_id, 'studio', 'register', _a) is distinct from _c then
    raise exception 'the user who asked should get their enrolment challenge';
  end if;

  -- An id nobody issued is refused.
  if public.webauthn_challenge_take(gen_random_uuid(), 'studio', 'login') is not null then
    raise exception 'an unknown id should be refused';
  end if;

  -- An enrolment challenge cannot be issued without a user.
  begin
    perform public.webauthn_challenge_issue('studio', 'register', _c);
    raise exception 'an enrolment challenge without a user was accepted';
  exception when check_violation then null;
  end;

  -- Five minutes to live.
  _id := public.webauthn_challenge_issue('studio', 'login', _c);
  if (select expires_at - created_at from public.webauthn_challenges where id = _id) <> interval '5 minutes' then
    raise exception 'a challenge should expire after five minutes';
  end if;
end $$;
reset role;

-- An expired challenge is refused, and issuing a new one clears the rest.
insert into public.webauthn_challenges (id, app, purpose, challenge, expires_at) values
  ('00000000-0000-4000-8000-000000000001', 'studio', 'login', 'expired-challenge-1', now() - interval '1 second'),
  ('00000000-0000-4000-8000-000000000002', 'capture', 'login', 'expired-challenge-2', now() - interval '1 hour');
set local role service_role;
do $$ begin
  if public.webauthn_challenge_take('00000000-0000-4000-8000-000000000001', 'studio', 'login') is not null then
    raise exception 'an expired challenge should be refused';
  end if;
  perform public.webauthn_challenge_issue('capture', 'login', 'fresh-challenge-0123');
  if exists (select 1 from public.webauthn_challenges where expires_at <= now()) then
    raise exception 'issuing a challenge should clear expired ones';
  end if;
end $$;
reset role;

-- Nobody else may issue, take, read or write challenges.
set local role anon;
do $$ begin
  begin
    perform public.webauthn_challenge_issue('studio', 'login', 'abcdefghijklmnopqrstuvwxyz');
    raise exception 'anon could issue a challenge';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.webauthn_challenge_take(gen_random_uuid(), 'studio', 'login');
    raise exception 'anon could take a challenge';
  exception when insufficient_privilege then null;
  end;
  if t.visible('public.webauthn_challenges') >= 0 then raise exception 'anon can read challenges'; end if;
end $$;
reset role;

select t.claims(:'a_id');
set local role authenticated;
do $$ begin
  begin
    perform public.webauthn_challenge_issue('studio', 'register', 'abcdefghijklmnopqrstuvwxyz', auth.uid());
    raise exception 'a signed-in user could issue a challenge';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.webauthn_challenge_take(gen_random_uuid(), 'studio', 'login');
    raise exception 'a signed-in user could take a challenge';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.webauthn_challenges (app, purpose, challenge, user_id)
    values ('studio', 'register', 'abcdefghijklmnopqrstuvwxyz', auth.uid());
    raise exception 'a signed-in user could write a challenge';
  exception when insufficient_privilege then null;
  end;
  if t.visible('public.webauthn_challenges') >= 0 then raise exception 'a signed-in user can read challenges'; end if;
end $$;
reset role;
rollback;
