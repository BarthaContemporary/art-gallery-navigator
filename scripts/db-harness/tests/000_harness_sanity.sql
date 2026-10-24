-- The harness itself: roles and RLS behave as on the live server.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset
insert into public.crm_contacts (first_name, last_name, email) values ('Test', 'Person', 'test.person@example.com');

-- An admin sees the contact.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if (select count(*) from public.crm_contacts) <> 1 then raise exception 'admin should see 1 contact'; end if;
end $$;
reset role;

-- The accountant does not (no CRM for the accountant).
select t.claims(:'acc_id');
set local role authenticated;
do $$ begin
  if t.visible('public.crm_contacts') > 0 then raise exception 'accountant should see no contacts'; end if;
end $$;
reset role;

-- Nor does an anonymous caller.
set local role anon;
do $$ begin
  if t.visible('public.crm_contacts') > 0 then raise exception 'anon should see no contacts'; end if;
end $$;
reset role;
rollback;
