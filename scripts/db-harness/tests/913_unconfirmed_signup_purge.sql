-- 0097 §4 (database-5, database-7): the retention job's purge of newsletter
-- sign-ups never confirmed.
--   • An untouched sign-up past its 30 days goes, and nothing of the person
--     stays behind: no activity_log entry (neither the sign-up as it arrived
--     nor the delete) and no address in email_events.
--   • A sign-up the gallery has started working with stays, with its log:
--     contact details or notes added, a tag of the gallery's own, put on a
--     list, sent a private offer or a newsletter, a data-subject request,
--     due diligence started.
--   • Nobody else's log or delivery events are touched; the result keeps
--     its unconfirmed_signups count.
\ir ../lib/helpers.sql
begin;

-- Sign-ups as the newsletter box writes them, 31 days old (and one 10 days old).
insert into public.crm_contacts
  (id, first_name, last_name, email, marketing_consent, consent_source,
   consent_confirm_token, consent_confirm_sent_at, consent_evidence, tags, created_at)
select ('00000000-0000-4000-8000-0000000009' || n)::uuid, 'Signup' || n, 'Person', 'signup' || n || '@example.com',
       false, 'website_newsletter', repeat(n, 48),
       now() - case when n = '10' then interval '10 days' else interval '31 days' end,
       jsonb_build_object('marketing', jsonb_build_object('form', 'newsletter', 'ip_hash', 'abc' || n, 'user_agent', 'Safari')),
       '{newsletter}', now() - interval '31 days'
  from unnest(array['01','02','03','04','05','06','07','08','09','10','11']) n;
-- Someone else entirely, with history.
insert into public.crm_contacts (id, first_name, email)
  values ('00000000-0000-4000-8000-000000000999', 'Other', 'other@example.com');
update public.crm_contacts set notes = 'Long-standing client' where id = '00000000-0000-4000-8000-000000000999';

-- What staff did with some of them inside their 30 days.
update public.crm_contacts set phone = '+44 20 7000 0000', notes = 'Rang about the Shibata box'
 where id = '00000000-0000-4000-8000-000000000902';
update public.crm_contacts set tags = '{newsletter,tefaf-2027}' where id = '00000000-0000-4000-8000-000000000903';
insert into public.crm_lists (name) values ('Lacquer collectors') returning id as list_id \gset
insert into public.crm_list_members (list_id, contact_id) values (:'list_id', '00000000-0000-4000-8000-000000000904');
insert into public.offers (title) values ('Private offer') returning id as offer_id \gset
insert into public.offer_recipients (offer_id, contact_id) values (:'offer_id', '00000000-0000-4000-8000-000000000905');
insert into public.crm_campaigns (name) values ('Autumn') returning id as camp_id \gset
insert into public.crm_campaign_recipients (campaign_id, contact_id) values (:'camp_id', '00000000-0000-4000-8000-000000000906');
insert into public.dp_requests (contact_id, kind) values ('00000000-0000-4000-8000-000000000907', 'access');
update public.crm_contacts set kyc_status = 'pending' where id = '00000000-0000-4000-8000-000000000908';
update public.crm_contacts set custom_fields = '{"aml_notes": "Passport seen"}' where id = '00000000-0000-4000-8000-000000000909';
-- 911 stays untouched and is purged too (two at once).

-- Delivery events of the confirmation emails, and others'.
insert into public.email_events (event_type, payload) values
  ('email.delivered', '{"type": "email.delivered", "data": {"email_id": "re_1", "to": ["signup01@example.com"]}}'),
  ('email.bounced', '{"type": "email.bounced", "data": {"email_id": "re_2", "to": ["Signup Person <SIGNUP11@example.com>"]}}'),
  ('email.delivered', '{"data": {"email_id": "re_3", "to": ["signup02@example.com"]}}'),
  ('email.delivered', '{"data": {"email_id": "re_4", "to": ["xsignup01@example.com"]}}'),
  ('email.delivered', '{"data": {"email_id": "re_5", "to": ["other@example.com"]}}');

do $$ begin
  if (select count(*) from public.activity_log
       where entity_type = 'crm_contacts' and entity_id = '00000000-0000-4000-8000-000000000901') <> 1 then
    raise exception 'setup: the sign-up should have been logged as it arrived';
  end if;
end $$;

select public.apply_retention() as result \gset
select set_config('t.result', :'result', true);

do $$
declare
  _gone uuid[] := array['00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000911']::uuid[];
  _kept uuid[] := array['00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000903',
                        '00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-000000000905',
                        '00000000-0000-4000-8000-000000000906', '00000000-0000-4000-8000-000000000907',
                        '00000000-0000-4000-8000-000000000908', '00000000-0000-4000-8000-000000000909',
                        '00000000-0000-4000-8000-000000000910', '00000000-0000-4000-8000-000000000999']::uuid[];
  _r jsonb := current_setting('t.result')::jsonb;
begin
  if (_r ->> 'unconfirmed_signups')::int is distinct from 2 then
    raise exception 'unconfirmed_signups should report 2, got %', _r;
  end if;
  if exists (select 1 from public.crm_contacts where id = any (_gone)) then
    raise exception 'the untouched sign-ups were not purged';
  end if;
  if (select count(*) from public.crm_contacts where id = any (_kept)) <> cardinality(_kept) then
    raise exception 'a sign-up the gallery worked with (or another contact) was purged: %',
      (select array_agg(k) from unnest(_kept) k where not exists (select 1 from public.crm_contacts c where c.id = k));
  end if;

  -- database-5: nothing of the purged people in the change log.
  if exists (select 1 from public.activity_log where entity_type = 'crm_contacts' and entity_id = any (_gone)) then
    raise exception 'the change log still holds the purged sign-ups';
  end if;
  if exists (select 1 from public.activity_log where changes::text ilike '%signup01@example.com%'
                                                  or changes::text ilike '%signup11@example.com%') then
    raise exception 'an address of a purged sign-up survives in the change log';
  end if;
  -- ... while the history of the contacts that stay is kept.
  if not exists (select 1 from public.activity_log where entity_id = '00000000-0000-4000-8000-000000000902' and action = 'UPDATE')
     or not exists (select 1 from public.activity_log where entity_id = '00000000-0000-4000-8000-000000000999' and action = 'UPDATE') then
    raise exception 'the history of a kept contact was removed';
  end if;

  -- Delivery events: the purged addresses go, longer or other addresses stay.
  if exists (select 1 from public.email_events where lower(payload::text) like '%signup01@example.com%'
                                                 and payload::text not like '%xsignup01%')
     or exists (select 1 from public.email_events where lower(payload::text) like '%signup11@example.com%') then
    raise exception 'a purged sign-up''s address survives in email_events';
  end if;
  if (select count(*) from public.email_events where payload = '{"erased": true}'::jsonb) <> 2 then
    raise exception 'exactly the two purged sign-ups'' events should be scrubbed';
  end if;
  if not exists (select 1 from public.email_events where payload::text like '%signup02@example.com%')
     or not exists (select 1 from public.email_events where payload::text like '%xsignup01@example.com%')
     or not exists (select 1 from public.email_events where payload::text like '%other@example.com%') then
    raise exception 'delivery events of kept contacts or of other addresses were scrubbed';
  end if;

  -- The list membership and the private offer link of kept sign-ups are intact.
  if not exists (select 1 from public.crm_list_members where contact_id = '00000000-0000-4000-8000-000000000904')
     or not exists (select 1 from public.offer_recipients where contact_id = '00000000-0000-4000-8000-000000000905') then
    raise exception 'a kept sign-up lost its list or offer';
  end if;
end $$;

-- The helper is internal; the job stays service-role only.
do $$ begin
  if has_function_privilege('authenticated', 'public.scrub_email_events(uuid[], text[])', 'execute')
     or has_function_privilege('anon', 'public.scrub_email_events(uuid[], text[])', 'execute') then
    raise exception 'scrub_email_events is executable by signed-in users or anon';
  end if;
  if has_function_privilege('authenticated', 'public.apply_retention()', 'execute')
     or not has_function_privilege('service_role', 'public.apply_retention()', 'execute') then
    raise exception 'apply_retention grants changed';
  end if;
end $$;
rollback;
