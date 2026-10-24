-- 0095: the website's exact email match is service-role only and exact;
-- a sign-up for an existing contact, or one that went on to enquire or
-- book, no longer exposes it to the unconfirmed-sign-up purge, and a
-- request whose link has expired is not kept.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

insert into public.crm_contacts (id, first_name, email, created_at) values
  ('00000000-0000-4000-8000-000000000001', 'John', 'John.Smith@Example.com', now() - interval '2 years'),
  ('00000000-0000-4000-8000-000000000002', 'Johnny', 'john.smith@example.com', now() - interval '1 year'),
  ('00000000-0000-4000-8000-000000000003', 'Ann', 'ann_lee@example.com', now());

-- Exact and case-insensitive; "_" and "%" are plain characters; oldest first.
set local role service_role;
do $$ begin
  if public.contact_id_by_email('JOHN.SMITH@example.com') is distinct from '00000000-0000-4000-8000-000000000001'
    then raise exception 'case-insensitive match should find the oldest contact'; end if;
  if public.contact_id_by_email('  john.smith@example.com ') is distinct from '00000000-0000-4000-8000-000000000001'
    then raise exception 'surrounding spaces should not matter'; end if;
  if public.contact_id_by_email('john_smith@example.com') is not null
    then raise exception '"_" matched another character'; end if;
  if public.contact_id_by_email('%@example.com') is not null
    then raise exception '"%%" matched as a wildcard'; end if;
  if public.contact_id_by_email('ann_lee@example.com') is distinct from '00000000-0000-4000-8000-000000000003'
    then raise exception 'an address with "_" should still find itself'; end if;
  if public.contact_id_by_email('annxlee@example.com') is not null
    then raise exception '"_" in the stored address matched another character'; end if;
  if public.contact_id_by_email('') is not null or public.contact_id_by_email(null) is not null
    then raise exception 'an empty address matched'; end if;
end $$;
reset role;

-- Neither the public key nor a signed-in user may call it.
set local role anon;
do $$ begin
  begin
    perform public.contact_id_by_email('john.smith@example.com');
    raise exception 'anon could call contact_id_by_email';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin
    perform public.contact_id_by_email('john.smith@example.com');
    raise exception 'staff could call contact_id_by_email';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Tokens the old sign-up code left on contacts.
insert into public.crm_contacts
  (id, first_name, email, consent_source, marketing_consent, consent_date, unsubscribed_at,
   consent_confirm_token, consent_confirm_sent_at, consent_evidence, tags, created_at)
values
  -- A former subscriber who opted out; a stranger then typed the address
  -- into the sign-up box five days ago. Must survive, opt-out intact, and
  -- the emailed link keeps working.
  ('00000000-0000-4000-8000-0000000000a1', 'Former', 'former@example.com', 'website_newsletter', false,
   now() - interval '3 years', now() - interval '1 year',
   repeat('a', 48), now() - interval '5 days',
   jsonb_build_object('marketing', jsonb_build_object(
     'form', 'newsletter', 'at', now() - interval '5 days', 'ip_hash', 'x')), '{newsletter}',
   now() - interval '3 years'),
  -- An imported client who never consented, signed up by somebody five
  -- days ago.
  ('00000000-0000-4000-8000-0000000000a2', 'Imported', 'imported@example.com', 'address_xlsx_import', false,
   null, null, repeat('b', 48), now() - interval '5 days',
   '{"marketing": {"version": "legacy-import", "attested_by": "owner"}}', '{}', now() - interval '3 years'),
  -- A contact the website created for a sign-up nobody confirmed: stays
  -- as it is, and the purge still clears it.
  ('00000000-0000-4000-8000-0000000000a3', 'Nobody', 'nobody@example.com', 'website_newsletter', false,
   null, null, repeat('c', 48), now() - interval '40 days',
   '{"marketing": {"form": "newsletter", "at": "2026-01-01T00:00:00Z"}}', '{newsletter}', now() - interval '40 days'),
  -- Another opted-out former subscriber, signed up by somebody 40 days ago:
  -- the link has expired, so the request is not kept at all.
  ('00000000-0000-4000-8000-0000000000a4', 'Lapsed', 'lapsed@example.com', 'website_newsletter', false,
   now() - interval '3 years', now() - interval '1 year',
   repeat('4', 48), now() - interval '40 days',
   '{"marketing": {"form": "newsletter", "at": "2026-01-01T00:00:00Z", "ip_hash": "y"}}', '{newsletter}',
   now() - interval '3 years'),
  -- Website sign-ups, never confirmed, that went on to send an enquiry or
  -- book a visit under the old code, which left the token in the column.
  -- Four years ago, with an enquiry from then (enquiries are kept three
  -- years):
  ('00000000-0000-4000-8000-0000000000a5', 'Enquired', 'enquired@example.com', 'website_newsletter', false,
   null, null, repeat('5', 48), now() - interval '4 years',
   jsonb_build_object('marketing', jsonb_build_object('form', 'newsletter', 'at', now() - interval '4 years', 'ip_hash', 'z')),
   '{newsletter}', now() - interval '4 years'),
  -- three years ago, with a visit from then (appointments are kept two years):
  ('00000000-0000-4000-8000-0000000000a6', 'Booked', 'booked@example.com', 'website_newsletter', false,
   null, null, repeat('6', 48), now() - interval '3 years',
   jsonb_build_object('marketing', jsonb_build_object('form', 'newsletter', 'at', now() - interval '3 years')),
   '{newsletter}', now() - interval '3 years'),
  -- and ten days ago, with an enquiry since: the link still works.
  ('00000000-0000-4000-8000-0000000000a7', 'Recent', 'recent@example.com', 'website_newsletter', false,
   null, null, repeat('7', 48), now() - interval '10 days',
   jsonb_build_object('marketing', jsonb_build_object('form', 'newsletter', 'at', now() - interval '10 days', 'ip_hash', 'w')),
   '{newsletter}', now() - interval '10 days');

insert into public.enquiries (contact_id, channel, message, created_at) values
  ('00000000-0000-4000-8000-0000000000a5', 'website', 'Work enquiry', now() - interval '4 years'),
  ('00000000-0000-4000-8000-0000000000a7', 'website', 'Work enquiry', now() - interval '5 days');
insert into public.appointments (contact_id, starts_at, ends_at, status, created_at) values
  ('00000000-0000-4000-8000-0000000000a6', now() - interval '3 years', now() - interval '3 years' + interval '1 hour',
   'completed', now() - interval '3 years');

-- Re-running the migration (it is idempotent) applies its one-off move to
-- these rows exactly as it did to the live ones.
\ir ../../../supabase/migrations/0095_public_forms.sql

do $$
declare r record;
begin
  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a1';
  if r.consent_confirm_token is not null or r.consent_confirm_sent_at is not null
    then raise exception 'the former subscriber kept the purge-marking token'; end if;
  if r.consent_evidence -> 'marketing_pending' ->> 'token_hash' is distinct from encode(sha256(convert_to(repeat('a', 48), 'UTF8')), 'hex')
    then raise exception 'the former subscriber''s pending link was not kept'; end if;
  if r.consent_evidence ? 'marketing'
    then raise exception 'unconfirmed sign-up evidence still stands as the consent record'; end if;
  if r.consent_evidence -> 'marketing_pending' ->> 'ip_hash' is distinct from 'x'
    then raise exception 'the sign-up evidence did not move with the token'; end if;
  if r.unsubscribed_at is null or r.marketing_consent then raise exception 'the opt-out changed'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a2';
  if r.consent_confirm_token is not null then raise exception 'the imported contact kept its token'; end if;
  if r.consent_evidence -> 'marketing' ->> 'version' is distinct from 'legacy-import'
    then raise exception 'the legacy-import note was moved or lost'; end if;
  if r.consent_evidence -> 'marketing_pending' ->> 'at' is null
    then raise exception 'the moved request has no time, so its link would never work'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a3';
  if r.consent_confirm_token is distinct from repeat('c', 48)
    then raise exception 'the website-created sign-up lost its token'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a4';
  if r.consent_confirm_token is not null then raise exception 'the lapsed request kept its token'; end if;
  if r.consent_evidence ? 'marketing_pending' or r.consent_evidence ? 'marketing'
    then raise exception 'a request whose link had expired was kept'; end if;
  if r.unsubscribed_at is null then raise exception 'the lapsed contact''s opt-out changed'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a5';
  if r.consent_confirm_token is not null then raise exception 'the sign-up that enquired kept its token'; end if;
  if r.consent_evidence ? 'marketing_pending' or r.consent_evidence ? 'marketing'
    then raise exception 'the enquirer''s expired request was kept'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a6';
  if r.consent_confirm_token is not null then raise exception 'the sign-up that booked kept its token'; end if;

  select * into r from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a7';
  if r.consent_confirm_token is not null then raise exception 'the recent sign-up that enquired kept its token'; end if;
  if r.consent_evidence -> 'marketing_pending' ->> 'token_hash' is distinct from encode(sha256(convert_to(repeat('7', 48), 'UTF8')), 'hex')
    or r.consent_evidence -> 'marketing_pending' ->> 'ip_hash' is distinct from 'w'
    then raise exception 'the recent sign-up''s request did not move with its link'; end if;
  if r.consent_evidence ? 'marketing'
    then raise exception 'the recent sign-up''s unconfirmed evidence still stands as the consent record'; end if;
end $$;

-- The retention job clears the abandoned sign-up and nothing else: the
-- old enquiry and visit go, the people who made them stay.
select public.apply_retention();
do $$ begin
  if exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a3')
    then raise exception 'the abandoned sign-up was not purged'; end if;
  if exists (select 1 from public.enquiries where contact_id = '00000000-0000-4000-8000-0000000000a5')
    or exists (select 1 from public.appointments where contact_id = '00000000-0000-4000-8000-0000000000a6')
    then raise exception 'the old enquiry or visit was not purged'; end if;
  if (select count(*) from public.crm_contacts where id in (
        '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2',
        '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a5',
        '00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-0000000000a7')) <> 6
    then raise exception 'the retention job deleted an existing contact, an enquirer or a booker'; end if;
end $$;

-- What the website does from now on, as the service role: a pending entry
-- found by its hash, confirmed by the token's owner, without touching
-- do_not_mail.
set local role service_role;
update public.crm_contacts set do_not_mail = true where id = '00000000-0000-4000-8000-0000000000a1';
do $$
declare n integer;
begin
  update public.crm_contacts
     set marketing_consent = true, unsubscribed_at = null,
         consent_evidence = (consent_evidence - 'marketing_pending')
           || jsonb_build_object('marketing', (consent_evidence -> 'marketing_pending') - 'token_hash')
   where id = '00000000-0000-4000-8000-0000000000a1'
     and consent_evidence -> 'marketing_pending' ->> 'token_hash' = encode(sha256(convert_to(repeat('a', 48), 'UTF8')), 'hex');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the service role could not confirm by the token hash'; end if;
  if not (select do_not_mail from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000a1')
    then raise exception 'do_not_mail changed'; end if;
end $$;
reset role;
rollback;
