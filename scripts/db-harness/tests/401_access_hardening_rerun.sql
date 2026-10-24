-- 0093: the one-off scrub blanks offer passwords and opt-in tokens that the
-- old trigger had already copied into activity_log, leaves everything else
-- in those entries alone, and the migration can be applied again safely.
\ir ../lib/helpers.sql
begin;
set local client_min_messages = warning;

-- Entries as the trigger before 0093 wrote them: whole rows on insert and
-- delete, {old, new} per changed column on edit.
insert into public.activity_log (entity_type, entity_id, action, changes) values
  ('offers', gen_random_uuid(), 'INSERT',
   '{"new": {"title": "Private", "access_password": "hunter2"}}'),
  ('offers', gen_random_uuid(), 'UPDATE',
   '{"access_password": {"old": "hunter2", "new": "swordfish"}, "title": {"old": "A", "new": "B"}}'),
  ('offers', gen_random_uuid(), 'UPDATE',
   '{"access_password": {"old": null, "new": "letmein"}}'),
  ('offers', gen_random_uuid(), 'DELETE',
   '{"old": {"title": "Gone", "access_password": "opensesame"}}'),
  ('offers', gen_random_uuid(), 'INSERT',
   '{"new": {"title": "No password", "access_password": null}}'),
  ('crm_contacts', gen_random_uuid(), 'UPDATE',
   '{"consent_confirm_token": {"old": null, "new": "tok-abc"}, "phone": {"old": null, "new": "0207"}}'),
  ('pieces', gen_random_uuid(), 'UPDATE',
   '{"title": {"old": "access_password", "new": "hunter2 bowl"}}');

\ir ../../../supabase/migrations/0093_access_hardening.sql

do $$ begin
  if exists (select 1 from public.activity_log
              where entity_type in ('offers', 'crm_contacts')
                and changes::text ~ '(hunter2|swordfish|letmein|opensesame|tok-abc)') then
    raise exception 'a secret survived the scrub';
  end if;
  if not exists (select 1 from public.activity_log
                  where changes = '{"access_password": {"old": "[redacted]", "new": "[redacted]"}, "title": {"old": "A", "new": "B"}}'::jsonb) then
    raise exception 'the scrub should keep the rest of an edit';
  end if;
  if not exists (select 1 from public.activity_log
                  where changes = '{"access_password": {"old": null, "new": "[redacted]"}}'::jsonb) then
    raise exception 'the scrub should keep "set where there was none"';
  end if;
  if not exists (select 1 from public.activity_log
                  where changes = '{"new": {"title": "Private", "access_password": "[redacted]"}}'::jsonb)
     or not exists (select 1 from public.activity_log
                  where changes = '{"old": {"title": "Gone", "access_password": "[redacted]"}}'::jsonb) then
    raise exception 'the scrub should redact whole-row entries in place';
  end if;
  if not exists (select 1 from public.activity_log
                  where changes = '{"new": {"title": "No password", "access_password": null}}'::jsonb) then
    raise exception 'an empty password should stay empty';
  end if;
  if not exists (select 1 from public.activity_log
                  where changes = '{"consent_confirm_token": {"old": null, "new": "[redacted]"}, "phone": {"old": null, "new": "0207"}}'::jsonb) then
    raise exception 'the opt-in token should be redacted and the rest kept';
  end if;
  -- Other entities are untouched, even when a value happens to look alike.
  if not exists (select 1 from public.activity_log
                  where entity_type = 'pieces' and changes -> 'title' ->> 'new' = 'hunter2 bowl') then
    raise exception 'the scrub touched an entry it should not have';
  end if;
end $$;

-- Applying it a third time changes nothing and still leaves no exposure.
\ir ../../../supabase/migrations/0093_access_hardening.sql
do $$ begin
  if exists (select 1 from public.vw_function_exposure where anon_can_execute or public_can_execute) then
    raise exception 're-running left a function open to anon or PUBLIC';
  end if;
  if (select count(*) from public.activity_log where changes::text like '%[redacted]%') <> 5 then
    raise exception 're-running should leave the same five redacted entries';
  end if;
end $$;
rollback;
