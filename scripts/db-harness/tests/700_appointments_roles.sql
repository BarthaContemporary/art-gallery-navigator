-- Appointments are admin and staff only, as the studio's calendar gate
-- assumes (apps/studio/src/lib/calendar-access.ts: CALENDAR_ROLES). The
-- shared CalDAV calendar has no database policy of its own, so the studio
-- gives it the same roles as this table; if this ever changes, change both.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset
select t.make_user('norole@example.com') as none_id \gset
insert into public.appointments (starts_at, ends_at, name, email)
values (now() + interval '1 day', now() + interval '1 day 1 hour', 'Test Visitor', 'visitor@example.com');

-- Admin and staff see the booking and can confirm it.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if t.visible('public.appointments') <> 1 then raise exception 'admin should see 1 appointment'; end if;
end $$;
reset role;

select t.claims(:'staff_id');
set local role authenticated;
do $$
declare n int;
begin
  if t.visible('public.appointments') <> 1 then raise exception 'staff should see 1 appointment'; end if;
  update public.appointments set status = 'confirmed';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'staff should be able to confirm the appointment'; end if;
end $$;
reset role;

-- The accountant, a user with no role and an anonymous caller see none and
-- change none.
select t.claims(:'acc_id');
set local role authenticated;
do $$
declare n int;
begin
  if t.visible('public.appointments') > 0 then raise exception 'accountant should see no appointments'; end if;
  update public.appointments set status = 'cancelled';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'accountant should not change appointments'; end if;
end $$;
reset role;

select t.claims(:'none_id');
set local role authenticated;
do $$ begin
  if t.visible('public.appointments') > 0 then raise exception 'a user with no role should see no appointments'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  if t.visible('public.appointments') > 0 then raise exception 'anon should see no appointments'; end if;
end $$;
reset role;

-- Nothing above changed the booking but staff's confirmation.
do $$ begin
  if (select status from public.appointments) <> 'confirmed' then raise exception 'appointment status should be confirmed'; end if;
end $$;
rollback;
