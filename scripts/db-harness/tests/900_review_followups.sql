-- 0096: vw_anon_exposure for the service role only; the retention job clears
-- expired security records and expired pending newsletter requests.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if t.visible('public.vw_anon_exposure') >= 0 then raise exception 'staff can read vw_anon_exposure'; end if;
end $$;
reset role;
set local role service_role;
do $$ begin
  perform count(*) from public.vw_anon_exposure;
end $$;
reset role;

-- Expired and current rows of each kind.
insert into public.pending_uploads (path, user_id, scope, record_id, expires_at)
values ('documents/old.pdf', :'staff_id', 'document', null, now() - interval '3 days'),
       ('documents/new.pdf', :'staff_id', 'document', null, now() + interval '1 hour');
insert into public.webauthn_challenges (app, purpose, challenge, user_id, expires_at)
values ('studio', 'login', repeat('a', 32), null, now() - interval '3 days'),
       ('studio', 'login', repeat('b', 32), null, now() + interval '5 minutes');
insert into public.crm_contacts (first_name, email, consent_evidence) values
  ('Old', 'old.pending@example.com', jsonb_build_object('marketing_pending', jsonb_build_object('at', now() - interval '40 days', 'token_hash', 'x'), 'contact', jsonb_build_object('at', now()))),
  ('New', 'new.pending@example.com', jsonb_build_object('marketing_pending', jsonb_build_object('at', now() - interval '2 days', 'token_hash', 'y')));

select public.apply_retention();

do $$ begin
  if exists (select 1 from public.pending_uploads where path = 'documents/old.pdf') then raise exception 'expired upload slip kept'; end if;
  if not exists (select 1 from public.pending_uploads where path = 'documents/new.pdf') then raise exception 'live upload slip removed'; end if;
  if exists (select 1 from public.webauthn_challenges where challenge = repeat('a', 32)) then raise exception 'expired challenge kept'; end if;
  if not exists (select 1 from public.webauthn_challenges where challenge = repeat('b', 32)) then raise exception 'live challenge removed'; end if;
  if exists (select 1 from public.crm_contacts where email = 'old.pending@example.com' and consent_evidence ? 'marketing_pending') then raise exception 'expired pending request kept'; end if;
  if not exists (select 1 from public.crm_contacts where email = 'old.pending@example.com' and consent_evidence ? 'contact') then raise exception 'other consent evidence lost'; end if;
  if not exists (select 1 from public.crm_contacts where email = 'new.pending@example.com' and consent_evidence ? 'marketing_pending') then raise exception 'live pending request removed'; end if;
end $$;
rollback;
