-- 0093 (F5): the accountant reads only the stock-book part of the change log,
-- and offer passwords and opt-in tokens never reach the log.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- One of everything the audit trigger logs: a work (and its financials row),
-- a non-JvdB work, a contact with an opt-in token, an offer with a password.
insert into public.pieces (title) values ('Tea bowl') returning id as piece_id \gset
update public.piece_financials set purchase_cost = 100 where piece_id = :'piece_id';
insert into public.external_pieces (title) values ('Consigned screen') returning id as ext_id \gset
insert into public.crm_contacts (first_name, last_name, email, consent_confirm_token)
  values ('Ada', 'Collector', 'ada@example.com', 'tok-secret-1') returning id as contact_id \gset
update public.crm_contacts set consent_confirm_token = 'tok-secret-2' where id = :'contact_id';
insert into public.offers (title, access_password) values ('Private selection', 'hunter2') returning id as offer_id \gset
update public.offers set access_password = 'swordfish', title = 'Private selection II' where id = :'offer_id';
update public.offers set access_password = null where id = :'offer_id';
insert into public.offers (title, access_password) values ('Gone', 'letmein') returning id as gone_id \gset
delete from public.offers where id = :'gone_id';

-- No secret value is in the log, but the log still says they changed.
do $$ begin
  if exists (select 1 from public.activity_log
              where changes::text ~ '(hunter2|swordfish|letmein|tok-secret)') then
    raise exception 'a secret value reached activity_log';
  end if;
  if not exists (select 1 from public.activity_log
                  where entity_type = 'offers' and action = 'INSERT'
                    and changes -> 'new' ->> 'access_password' = '[redacted]') then
    raise exception 'offer insert should record a redacted password';
  end if;
  if not exists (select 1 from public.activity_log
                  where entity_type = 'offers' and action = 'UPDATE'
                    and changes -> 'access_password' = '{"old": "[redacted]", "new": "[redacted]"}'::jsonb
                    and changes -> 'title' ->> 'new' = 'Private selection II') then
    raise exception 'offer edit should record a redacted change next to the plain one';
  end if;
  if not exists (select 1 from public.activity_log
                  where entity_type = 'offers' and action = 'UPDATE'
                    and changes -> 'access_password' = '{"old": "[redacted]", "new": null}'::jsonb) then
    raise exception 'clearing the password should be recorded as cleared';
  end if;
  if not exists (select 1 from public.activity_log
                  where entity_type = 'offers' and action = 'DELETE'
                    and changes -> 'old' ->> 'access_password' = '[redacted]') then
    raise exception 'offer delete should record a redacted password';
  end if;
  if not exists (select 1 from public.activity_log
                  where entity_type = 'crm_contacts' and action = 'INSERT'
                    and changes -> 'new' ->> 'consent_confirm_token' = '[redacted]'
                    and changes -> 'new' ->> 'email' = 'ada@example.com') then
    raise exception 'contact insert should keep the row but redact the token';
  end if;
end $$;

-- Admin: the whole log, as before.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if (select count(distinct entity_type) from public.activity_log
       where entity_type in ('pieces', 'external_pieces', 'piece_financials', 'crm_contacts', 'offers')) <> 5 then
    raise exception 'admin should see every kind of entry';
  end if;
end $$;
reset role;

-- Accountant: the stock book's entries (the record page and the list page
-- read them), never the CRM or the offers.
select set_config('t.piece_id', :'piece_id', true), set_config('t.ext_id', :'ext_id', true);
select t.claims(:'acc_id');
set local role authenticated;
do $$
declare
  _piece uuid := current_setting('t.piece_id')::uuid;
  _ext   uuid := current_setting('t.ext_id')::uuid;
begin
  if exists (select 1 from public.activity_log where entity_type not in ('pieces', 'external_pieces', 'piece_financials')) then
    raise exception 'accountant can read CRM or offer entries';
  end if;
  if exists (select 1 from public.activity_log where changes::text like '%ada@example.com%') then
    raise exception 'accountant can read a contact through the log';
  end if;
  if (select count(*) from public.activity_log where entity_type = 'pieces' and entity_id = _piece) < 1
     or (select count(*) from public.activity_log where entity_type = 'piece_financials' and entity_id = _piece) < 1
     or (select count(*) from public.activity_log where entity_type = 'external_pieces' and entity_id = _ext) < 1 then
    raise exception 'accountant should still read work, non-JvdB work and financials entries';
  end if;
end $$;
reset role;

-- Staff: no change log (unchanged).
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if t.visible('public.activity_log') > 0 then raise exception 'staff can read activity_log'; end if;
end $$;
reset role;

-- Anon: nothing.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if t.visible('public.activity_log') > 0 then raise exception 'anon can read activity_log'; end if;
end $$;
reset role;

-- Service role: everything.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  if not exists (select 1 from public.activity_log where entity_type = 'crm_contacts') then
    raise exception 'service role should read the whole log';
  end if;
end $$;
reset role;
rollback;
