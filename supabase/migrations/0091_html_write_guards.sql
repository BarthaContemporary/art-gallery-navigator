-- 0091_html_write_guards
-- makers.profile_html is shown as HTML in the studio (the maker page's
-- rich-text editor), so it must only ever hold what the studio's allow-list
-- sanitiser lets through. The studio sanitises it on save (PATCH
-- /api/makers/[id]/profile) and again when the page reads it, but the
-- database did not hold anyone to that: staff may update makers, and the
-- REST API is reachable with the public key, so a staff user could write
-- markup straight into the column and have it run in an admin's session
-- (security review 2026-10, finding F3).
--
-- From here the column takes a new value only from the service role (the
-- profile route writes it with the service client after sanitising) or from
-- the database's own roles (migrations, maintenance). A signed-in user's or
-- an anonymous connection may still clear it, and may still change every
-- other column exactly as before.
--
-- current_user, not the JWT claims: PostgREST switches to the request's role
-- (anon, authenticated or service_role) before running the statement, and a
-- trigger that is not SECURITY DEFINER runs as that role, so it cannot be
-- talked out of it.

create or replace function public.guard_maker_profile_html()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _changed boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    _changed := true;
  else
    _changed := new.profile_html is distinct from old.profile_html;
  end if;
  -- Clearing it is harmless; setting it is the route's job.
  if _changed and nullif(new.profile_html, '') is not null then
    raise exception 'makers.profile_html is written through the studio''s profile editor only'
      using errcode = '42501',
            hint = 'PATCH /api/makers/<id>/profile sanitises the HTML and saves it.';
  end if;
  return new;
end;
$$;

comment on function public.guard_maker_profile_html() is
  'Refuses a new makers.profile_html from anon/authenticated connections: only the studio''s profile route (service role, after sanitising) sets it. Security review 2026-10, F3.';
-- A trigger fires whatever the caller's EXECUTE rights; nobody needs to call
-- it directly.
revoke all on function public.guard_maker_profile_html() from public, anon, authenticated;

drop trigger if exists trg_makers_guard_profile_html on public.makers;
create trigger trg_makers_guard_profile_html
  before insert or update of profile_html on public.makers
  for each row execute function public.guard_maker_profile_html();

notify pgrst, 'reload schema';
