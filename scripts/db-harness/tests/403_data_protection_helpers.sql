-- 0093 (F13): the data-protection helpers that list contacts are for the
-- service role (Admin → Data protection reads them with the service client),
-- not for any signed-in user and not for anon.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

-- One contact on the bulk-import consent note alone, one untouched for six
-- years with no consent (due for review), one with a sale (a legal hold).
insert into public.crm_contacts (first_name, last_name, email, marketing_consent, consent_source)
  values ('Weak', 'Basis', 'weak@example.com', true, 'pre-existing (import)') returning id as weak_id \gset
insert into public.crm_contacts (first_name, last_name, email, marketing_consent, created_at, updated_at)
  values ('Long', 'Dormant', 'dormant@example.com', false, now() - interval '6 years', now() - interval '6 years')
  returning id as dormant_id \gset
insert into public.crm_contacts (first_name, last_name, email) values ('Held', 'Buyer', 'held@example.com')
  returning id as held_id \gset
insert into public.pieces (title) values ('Sold bowl') returning id as piece_id \gset
update public.piece_financials set buyer_contact_id = :'held_id' where piece_id = :'piece_id';
select set_config('t.held_id', :'held_id', true);

-- Signed-in users of every role, and anon: refused outright, not filtered.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  begin perform public.contacts_with_weak_marketing_basis(); raise exception 'admin user session could call contacts_with_weak_marketing_basis';
  exception when insufficient_privilege then null; end;
  begin perform public.contact_legal_holds(current_setting('t.held_id')::uuid); raise exception 'admin user session could call contact_legal_holds';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_contacts_for_review') <> -1 then raise exception 'admin user session can read vw_contacts_for_review'; end if;
  -- The admin still reads the contacts themselves.
  if (select count(*) from public.crm_contacts) < 3 then raise exception 'admin should still see contacts'; end if;
end $$;
reset role;

select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin perform public.contacts_with_weak_marketing_basis(); raise exception 'staff could call contacts_with_weak_marketing_basis';
  exception when insufficient_privilege then null; end;
  begin perform public.contact_legal_holds(current_setting('t.held_id')::uuid); raise exception 'staff could call contact_legal_holds';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_contacts_for_review') <> -1 then raise exception 'staff can read vw_contacts_for_review'; end if;
  if (select count(*) from public.crm_contacts) < 3 then raise exception 'staff should still see contacts'; end if;
end $$;
reset role;

select t.claims(:'acc_id');
set local role authenticated;
do $$ begin
  begin perform public.contacts_with_weak_marketing_basis(); raise exception 'accountant could call contacts_with_weak_marketing_basis';
  exception when insufficient_privilege then null; end;
  begin perform public.contact_legal_holds(current_setting('t.held_id')::uuid); raise exception 'accountant could call contact_legal_holds';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_contacts_for_review') <> -1 then raise exception 'accountant can read vw_contacts_for_review'; end if;
  if t.visible('public.crm_contacts') > 0 then raise exception 'accountant sees contacts'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin perform public.contacts_with_weak_marketing_basis(); raise exception 'anon could call contacts_with_weak_marketing_basis';
  exception when insufficient_privilege then null; end;
  begin perform public.contact_legal_holds(current_setting('t.held_id')::uuid); raise exception 'anon could call contact_legal_holds';
  exception when insufficient_privilege then null; end;
  if t.visible('public.vw_contacts_for_review') > 0 then raise exception 'anon can read vw_contacts_for_review'; end if;
end $$;
reset role;

-- The service role (the data-protection page, the contact page): all three
-- answer as before. The view now runs with the reader's rights, which for
-- the service role still means every contact.
select set_config('t.weak_id', :'weak_id', true), set_config('t.dormant_id', :'dormant_id', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  if not exists (select 1 from public.contacts_with_weak_marketing_basis() w where w.id = current_setting('t.weak_id')::uuid) then
    raise exception 'service role should get the weak-basis contact';
  end if;
  if not exists (select 1 from public.vw_contacts_for_review v where v.id = current_setting('t.dormant_id')::uuid) then
    raise exception 'service role should get the dormant contact from the review view';
  end if;
  if exists (select 1 from public.vw_contacts_for_review v where v.id = current_setting('t.held_id')::uuid) then
    raise exception 'a contact under a legal hold is never due for review';
  end if;
  if coalesce(array_length(public.contact_legal_holds(current_setting('t.held_id')::uuid), 1), 0) <> 1 then
    raise exception 'service role should see the sale hold';
  end if;
end $$;
reset role;
do $$ begin
  if not coalesce((select 'security_invoker=true' = any (reloptions) from pg_class where oid = 'public.vw_contacts_for_review'::regclass), false) then
    raise exception 'vw_contacts_for_review should run with the reader''s rights';
  end if;
end $$;
rollback;
