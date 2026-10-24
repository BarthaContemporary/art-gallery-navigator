-- 0091: makers.profile_html takes a new value only from the service role
-- (the studio's profile route, after sanitising); every other maker edit by
-- staff and admin works as before.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset
insert into public.makers (id, display_name, profile_html)
values ('00000000-0000-4000-8000-0000000000a1', 'Kobayashi Shōmin', '<p>Kept text</p>');

-- Staff: the hole. Markup written straight through the API is refused, by
-- update, by insert and by upsert.
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare n int;
begin
  begin
    update public.makers set profile_html = '<img src=x onerror=alert(1)>'
     where id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'staff could write profile_html';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.makers (display_name, profile_html) values ('Planted', '<p onclick="x()">hi</p>');
    raise exception 'staff could insert a maker with profile_html';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.makers (id, display_name) values ('00000000-0000-4000-8000-0000000000a1', 'x')
    on conflict (id) do update set profile_html = '<svg onload=alert(1)>';
    raise exception 'staff could upsert profile_html';
  exception when insufficient_privilege then null;
  end;

  -- Everything else staff do to makers still works.
  update public.makers set display_name = 'Kobayashi Shōmin (1912–1994)', web_visible = true, life_dates = '1912–1994'
   where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'staff could not edit a maker''s details (% rows)', n; end if;
  -- A write that carries the column back unchanged (a whole-row save) passes.
  update public.makers set profile_html = profile_html, region = 'Japan'
   where id = '00000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'an unchanged profile_html blocked a staff save'; end if;
  -- Creating a maker (the makers page, quick capture) passes.
  insert into public.makers (display_name) values ('New maker');
  insert into public.makers (display_name, profile_html) values ('Blank profile', '');
end $$;
reset role;

-- Nothing staff tried landed.
do $$ begin
  if (select profile_html from public.makers where id = '00000000-0000-4000-8000-0000000000a1') <> '<p>Kept text</p>' then
    raise exception 'profile_html changed under a refused write';
  end if;
  if exists (select 1 from public.makers where display_name = 'Planted') then
    raise exception 'the refused insert left a maker';
  end if;
  if (select region from public.makers where id = '00000000-0000-4000-8000-0000000000a1') is distinct from 'Japan' then
    raise exception 'the staff detail edit did not land';
  end if;
end $$;

-- Admin through the API is held to the same rule (the studio saves it
-- with the service client for everyone).
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  begin
    update public.makers set profile_html = '<p>direct</p>' where id = '00000000-0000-4000-8000-0000000000a1';
    raise exception 'admin could write profile_html through the API';
  exception when insufficient_privilege then null;
  end;
  update public.makers set school_or_workshop = 'Tokyo School of Fine Arts'
   where id = '00000000-0000-4000-8000-0000000000a1';
  if not found then raise exception 'admin could not edit a maker''s details'; end if;
end $$;
reset role;

-- The anonymous key cannot reach it at all.
set local role anon;
do $$ begin
  begin
    update public.makers set profile_html = '<p>anon</p>';
    raise exception 'anon could update makers';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- The accountant is still read-only (row policies, unchanged).
select t.claims(:'acc_id');
set local role authenticated;
do $$ begin
  update public.makers set display_name = 'Accountant edit' where id = '00000000-0000-4000-8000-0000000000a1';
  if found then raise exception 'accountant could edit a maker'; end if;
end $$;
reset role;

-- Staff may clear it (nothing to run in an empty profile).
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  update public.makers set profile_html = null where id = '00000000-0000-4000-8000-0000000000a1';
  if not found then raise exception 'staff could not clear profile_html'; end if;
end $$;
reset role;

-- The service role (the profile route) sets it, by update and insert.
set local role service_role;
do $$ begin
  update public.makers set profile_html = '<p>Sanitised by the route</p>'
   where id = '00000000-0000-4000-8000-0000000000a1';
  if not found then raise exception 'service role could not write profile_html'; end if;
  insert into public.makers (display_name, profile_html) values ('Service maker', '<p>ok</p>');
end $$;
reset role;
do $$ begin
  if (select profile_html from public.makers where id = '00000000-0000-4000-8000-0000000000a1') <> '<p>Sanitised by the route</p>' then
    raise exception 'the service-role write did not land';
  end if;
end $$;

-- And the database's own role (migrations, maintenance) still can.
update public.makers set profile_html = '<p>Migration</p>' where id = '00000000-0000-4000-8000-0000000000a1';
rollback;
