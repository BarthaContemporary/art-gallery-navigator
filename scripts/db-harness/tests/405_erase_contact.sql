-- 0093: erase_contact() runs for the service role the studio calls it with,
-- leaves nothing about the person in activity_log (neither the old entries
-- nor new ones written by the erasure itself), and scrubs their address
-- from email_events. Signed-in users and anon cannot call it at all.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- A: no legal hold, so deleted. Logged on creation and on an edit.
insert into public.crm_contacts (first_name, last_name, email, phone)
  values ('John', 'Smith', 'John.Smith@Example.com', '0207 000 0000') returning id as a_id \gset
update public.crm_contacts set notes = 'Prefers Edo lacquer' where id = :'a_id';
-- B: bought a work, so pseudonymised rather than deleted.
insert into public.crm_contacts (first_name, last_name, email) values ('Held', 'Buyer', 'held@example.com')
  returning id as b_id \gset
insert into public.pieces (title) values ('Sold bowl') returning id as piece_id \gset
update public.piece_financials set buyer_contact_id = :'b_id' where piece_id = :'piece_id';
update public.crm_contacts set notes = 'Paid by transfer' where id = :'b_id';
-- C: someone else, whose history must survive.
insert into public.crm_contacts (first_name, last_name, email) values ('Other', 'Person', 'other@example.com')
  returning id as c_id \gset
-- D: erased through the legacy per-claim setting.
insert into public.crm_contacts (first_name, last_name, email) values ('Legacy', 'Claim', 'legacy@example.com')
  returning id as d_id \gset

-- A newsletter and a private offer sent to A, and their delivery events.
insert into public.crm_campaigns (name) values ('Spring') returning id as camp_id \gset
insert into public.crm_campaign_recipients (campaign_id, contact_id, resend_email_id)
  values (:'camp_id', :'a_id', 're_camp_a') returning id as a_rcpt \gset
insert into public.crm_campaign_recipients (campaign_id, contact_id, resend_email_id)
  values (:'camp_id', :'c_id', 're_camp_c') returning id as c_rcpt \gset
insert into public.offers (title) values ('Private') returning id as offer_id \gset
insert into public.offer_recipients (offer_id, contact_id, resend_email_id)
  values (:'offer_id', :'a_id', 're_offer_a') returning id as a_orcpt \gset

insert into public.email_events (event_type, campaign_recipient_id, offer_recipient_id, payload) values
  -- linked to A's campaign row
  ('email.delivered', :'a_rcpt', null, '{"type": "email.delivered", "data": {"email_id": "re_camp_a", "to": ["john.smith@example.com"]}}'),
  -- an offer webhook: no link column, only the provider's email id
  ('email.opened', null, null, '{"type": "email.opened", "data": {"email_id": "re_offer_a", "to": ["John.Smith@Example.com"]}}'),
  -- a refused offer send, linked to A's offer row
  ('failed', null, :'a_orcpt', '{"error": "invalid_to", "message": "Invalid `to` field: john.smith@example.com."}'),
  -- no link and an unknown id: matched by the address alone
  ('email.bounced', null, null, '{"type": "email.bounced", "data": {"email_id": "re_unknown", "to": ["Mr J Smith <JOHN.SMITH@example.com>"]}}'),
  -- other people whose addresses merely contain or extend A's
  ('email.delivered', null, null, '{"data": {"email_id": "re_x", "to": ["xjohn.smith@example.com"]}}'),
  ('email.delivered', null, null, '{"data": {"email_id": "re_y", "to": ["john.smith@example.com.au"]}}'),
  ('email.delivered', :'c_rcpt', null, '{"type": "email.delivered", "data": {"email_id": "re_camp_c", "to": ["other@example.com"]}}');

select set_config('t.a_id', :'a_id', true), set_config('t.b_id', :'b_id', true),
       set_config('t.c_id', :'c_id', true), set_config('t.d_id', :'d_id', true);
do $$ begin
  if (select count(*) from public.activity_log where entity_id = current_setting('t.a_id')::uuid) < 2 then
    raise exception 'setup: A should have been logged';
  end if;
end $$;

-- Anon and every signed-in role: refused before anything happens. (The
-- studio checks the admin role in its server action, then uses the service
-- client; no page calls this with a user's session.)
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin perform public.erase_contact(current_setting('t.a_id')::uuid); raise exception 'anon could erase';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin perform public.erase_contact(current_setting('t.a_id')::uuid); raise exception 'staff could erase';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select t.claims(:'acc_id');
set local role authenticated;
do $$ begin
  begin perform public.erase_contact(current_setting('t.a_id')::uuid); raise exception 'accountant could erase';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  begin perform public.erase_contact(current_setting('t.a_id')::uuid); raise exception 'an admin user session could erase directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.crm_contacts where id = current_setting('t.a_id')::uuid) then
    raise exception 'a refused call changed something';
  end if;
end $$;

-- The service role, as the studio calls it.
select set_config('t.log_max', coalesce(max(id), 0)::text, true) from public.activity_log;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare
  _r jsonb;
begin
  _r := public.erase_contact(current_setting('t.a_id')::uuid);
  if _r ->> 'mode' <> 'deleted' then raise exception 'A should be deleted, got %', _r; end if;
  _r := public.erase_contact(current_setting('t.b_id')::uuid);
  if _r ->> 'mode' <> 'anonymised' then raise exception 'B should be pseudonymised, got %', _r; end if;
  _r := public.erase_contact(gen_random_uuid());
  if _r ->> 'mode' <> 'missing' then raise exception 'an unknown id should report missing, got %', _r; end if;
end $$;
reset role;

-- The legacy per-claim setting is still accepted.
select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
do $$ begin
  if public.erase_contact(current_setting('t.d_id')::uuid) ->> 'mode' <> 'deleted' then
    raise exception 'the legacy service-role claim should be accepted';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.role', '', true);

do $$
declare
  _a uuid := current_setting('t.a_id')::uuid;
  _b uuid := current_setting('t.b_id')::uuid;
begin
  -- The erasures wrote nothing new into the change log…
  if exists (select 1 from public.activity_log where id > current_setting('t.log_max')::bigint) then
    raise exception 'erasure wrote to activity_log: %',
      (select jsonb_agg(changes) from public.activity_log where id > current_setting('t.log_max')::bigint);
  end if;
  -- …and nothing about A or B is left in it.
  if exists (select 1 from public.activity_log where entity_type = 'crm_contacts' and entity_id in (_a, _b)) then
    raise exception 'activity_log still holds an erased contact: %',
      (select jsonb_agg(changes) from public.activity_log where entity_id in (_a, _b));
  end if;
  if exists (select 1 from public.activity_log where changes::text ilike '%john.smith@example.com%'
                                                  or changes::text like '%held@example.com%'
                                                  or changes::text like '%Prefers Edo lacquer%'
                                                  or changes::text like '%Paid by transfer%') then
    raise exception 'an erased contact''s details survive in activity_log';
  end if;

  -- B is pseudonymised in place.
  if not exists (select 1 from public.crm_contacts
                  where id = _b and email is null and first_name = 'Erased contact' and notes is null and erased_at is not null) then
    raise exception 'B should be pseudonymised';
  end if;

  -- A's four delivery events are scrubbed; the others are untouched.
  if (select count(*) from public.email_events where payload = '{"erased": true}'::jsonb) <> 4 then
    raise exception 'expected four scrubbed events, got %',
      (select jsonb_agg(payload) from public.email_events where payload = '{"erased": true}'::jsonb);
  end if;
  if exists (select 1 from public.email_events where lower(payload::text) like '%"john.smith@example.com"%'
                                                  or lower(payload::text) like '%<john.smith@example.com>%'
                                                  or payload::text like '%field: john.smith@example.com.%') then
    raise exception 'A''s address survives in email_events';
  end if;
  if (select count(*) from public.email_events
       where payload ->> 'data' like '%xjohn.smith@example.com%'
          or payload ->> 'data' like '%john.smith@example.com.au%'
          or payload ->> 'data' like '%other@example.com%') <> 3 then
    raise exception 'events of other addresses were scrubbed';
  end if;
  if not exists (select 1 from public.email_events where event_type = 'email.bounced') then
    raise exception 'a scrubbed event should keep its type';
  end if;

  -- Logging carries on for everyone else in the same transaction.
  update public.crm_contacts set notes = 'Still logged' where id = current_setting('t.c_id')::uuid;
  if not exists (select 1 from public.activity_log
                  where entity_id = current_setting('t.c_id')::uuid and changes -> 'notes' ->> 'new' = 'Still logged') then
    raise exception 'logging stopped for other contacts after an erasure';
  end if;
  if (select count(*) from public.activity_log where entity_id = current_setting('t.c_id')::uuid) < 2 then
    raise exception 'C''s earlier history should survive';
  end if;
end $$;
rollback;
