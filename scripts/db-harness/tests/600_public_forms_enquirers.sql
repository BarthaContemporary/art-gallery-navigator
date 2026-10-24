-- The website's mailing-list requests and the unconfirmed-sign-up purge
-- (apply_retention, rule unconfirmed_signups). The purge deletes a contact
-- that carries consent_confirm_token once nothing else holds it; an
-- enquiry holds it only until the enquiries purge removes that enquiry,
-- three years on, in the same run. So the website keeps a request made
-- from an enquiry as a pending entry in consent_evidence, and moves an
-- earlier sign-up's token there once its contact sends an enquiry. These
-- rows are written as lib/newsletter-optin.ts writes them.
\ir ../lib/helpers.sql
begin;

insert into public.crm_contacts
  (id, first_name, email, consent_source, marketing_consent,
   consent_confirm_token, consent_confirm_sent_at, consent_evidence, tags, created_at)
values
  -- Created by an enquiry with the mailing-list box ticked, never
  -- confirmed: the request is a pending entry, the column is empty.
  ('00000000-0000-4000-8000-0000000000b1', 'Enquirer', 'enquirer@example.com', null, false,
   null, null,
   jsonb_build_object(
     'contact', jsonb_build_object('form', 'enquiry', 'at', '2023-01-01T00:00:00Z'),
     'marketing_pending', jsonb_build_object(
       'form', 'enquiry_mailing_list', 'at', '2023-01-01T00:00:00Z',
       'token_hash', encode(sha256(convert_to(repeat('d', 48), 'UTF8')), 'hex'))),
   '{website}', now() - interval '4 years'),
  -- The shape the website no longer writes: the same enquirer with the
  -- token in the column. Kept here to show what the purge would do to it.
  ('00000000-0000-4000-8000-0000000000b2', 'Column', 'column@example.com', null, false,
   repeat('e', 48), now() - interval '4 years',
   '{"contact": {"form": "enquiry"}, "marketing": {"form": "enquiry_mailing_list"}}', '{website}',
   now() - interval '4 years'),
  -- Signed up from the newsletter box, never confirmed, then sent an
  -- enquiry: the token has moved to a pending entry (settleSignUpPatch).
  ('00000000-0000-4000-8000-0000000000b3', 'Settled', 'settled@example.com', 'website_newsletter', false,
   null, null,
   jsonb_build_object('marketing_pending', jsonb_build_object(
     'form', 'newsletter', 'at', '2023-01-01T00:00:00Z',
     'token_hash', encode(sha256(convert_to(repeat('f', 48), 'UTF8')), 'hex'))),
   '{newsletter}', now() - interval '4 years'),
  -- Signed up from the newsletter box and nothing else: still an
  -- abandoned sign-up, still purged.
  ('00000000-0000-4000-8000-0000000000b4', 'Abandoned', 'abandoned@example.com', 'website_newsletter', false,
   repeat('a', 48), now() - interval '40 days',
   '{"marketing": {"form": "newsletter", "at": "2026-01-01T00:00:00Z"}}', '{newsletter}',
   now() - interval '40 days');

-- Each enquirer's only enquiry is older than the three years enquiries are kept.
insert into public.enquiries (contact_id, channel, message, created_at)
select id, 'website', 'Work enquiry', now() - interval '4 years'
  from public.crm_contacts
 where id in ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2',
              '00000000-0000-4000-8000-0000000000b3');

select public.apply_retention();

do $$ begin
  if exists (select 1 from public.enquiries where contact_id in (
       '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b2',
       '00000000-0000-4000-8000-0000000000b3'))
    then raise exception 'the old enquiries were not purged'; end if;
  if not exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000b1')
    then raise exception 'an enquirer with a pending mailing-list request was deleted as a sign-up'; end if;
  if not exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000b3')
    then raise exception 'a sign-up that went on to enquire was deleted as an abandoned sign-up'; end if;
  if exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000b2')
    then raise exception 'control: a column token on an enquirer should have made the purge delete it'; end if;
  if exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000b4')
    then raise exception 'the abandoned sign-up was not purged'; end if;
end $$;

-- What the website does with these rows, as the service role.
set local role service_role;
do $$
declare n integer;
begin
  -- The pending link is found by the hash of its token.
  if (select count(*) from public.crm_contacts
       where consent_evidence -> 'marketing_pending' ->> 'token_hash'
             = encode(sha256(convert_to(repeat('f', 48), 'UTF8')), 'hex')) <> 1
    then raise exception 'the settled sign-up''s link no longer resolves'; end if;

  -- Confirming keeps the link's hash and the wording agreed to.
  update public.crm_contacts
     set marketing_consent = true, unsubscribed_at = null,
         consent_evidence = (consent_evidence - 'marketing_pending')
           || jsonb_build_object('marketing',
                ((consent_evidence -> 'marketing_pending') - 'token_hash')
                || jsonb_build_object(
                     'token_hash', encode(sha256(convert_to(repeat('d', 48), 'UTF8')), 'hex'),
                     'confirmed_at', now(),
                     'confirmed_text', 'I would like to receive the gallery''s newsletter by email…',
                     'confirmed_version', '2026-10'))
   where id = '00000000-0000-4000-8000-0000000000b1'
     and consent_evidence -> 'marketing_pending' ->> 'token_hash'
         = encode(sha256(convert_to(repeat('d', 48), 'UTF8')), 'hex');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the service role could not confirm the enquirer''s request'; end if;

  -- A second press finds the link used for a subscription that stands.
  if not exists (select 1 from public.crm_contacts
                  where consent_evidence -> 'marketing' ->> 'token_hash'
                        = encode(sha256(convert_to(repeat('d', 48), 'UTF8')), 'hex')
                    and marketing_consent and unsubscribed_at is null)
    then raise exception 'a used link cannot be recognised'; end if;

  -- The confirmation-email log: only emails sent are written, and read
  -- back by key and time.
  insert into public.rate_limit_hits (key) values ('optin:sent:0123456789abcdef0123456789abcdef');
  if (select count(*) from public.rate_limit_hits
       where key = 'optin:sent:0123456789abcdef0123456789abcdef' and at >= now() - interval '6 hours') <> 1
    then raise exception 'the service role cannot read the email log'; end if;
end $$;
reset role;

-- An enquirer confirmed in this way is kept, like any subscriber.
select public.apply_retention();
do $$ begin
  if not exists (select 1 from public.crm_contacts where id = '00000000-0000-4000-8000-0000000000b1' and marketing_consent)
    then raise exception 'the confirmed enquirer was lost'; end if;
end $$;
rollback;
