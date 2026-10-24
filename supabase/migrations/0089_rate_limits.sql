-- 0089_rate_limits
-- A small fixed-window rate limiter shared by the public website forms, the
-- private-offer password gate and the studio's AI routes (security review
-- 2026-10, findings F12, F19, F21). Callers pass a key such as
-- "newsletter:ip:203.0.113.4" and the limit for that key; the function
-- records the hit and says whether it is within the limit.
--
-- Only the service role may call it (the apps call it from server code);
-- the table holds IP addresses and email hashes for at most a day, so it is
-- in retention_policies and cleared by apply_retention().

create table if not exists public.rate_limit_hits (
  id    bigint generated always as identity primary key,
  key   text not null,
  at    timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_at on public.rate_limit_hits (key, at desc);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from public, anon, authenticated;
grant all on public.rate_limit_hits to service_role;

comment on table public.rate_limit_hits is
  'Recent hits per rate-limit key (IP addresses, hashed emails, user ids). Kept one day.';

-- True when this hit is within _max hits per _window for _key (the hit is
-- recorded either way, so hammering a closed key keeps it closed).
create or replace function public.rate_limit_hit(_key text, _window interval, _max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _count integer;
begin
  if _key is null or length(_key) = 0 or length(_key) > 300 then
    raise exception 'rate_limit_hit: bad key';
  end if;
  -- One caller at a time per key: without this, requests arriving together
  -- each count before seeing the others' hits and all pass the limit.
  perform pg_advisory_xact_lock(hashtextextended('rate_limit:' || _key, 0));
  insert into public.rate_limit_hits (key) values (_key);
  select count(*) into _count
    from public.rate_limit_hits
   where key = _key and at > now() - _window;
  -- Now and then, drop hits older than a day.
  if random() < 0.01 then
    delete from public.rate_limit_hits where at < now() - interval '1 day';
  end if;
  return _count <= _max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, interval, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, interval, integer) to service_role;

-- Retention: a day, cleared by apply_retention() (CLAUDE.md personal-data rule).
insert into public.retention_policies (key, label, days, mode, basis) values
  ('rate_limit_hits', 'Rate-limit hits (IP addresses, hashed emails, user ids)', 1, 'purge',
   'Legitimate interest — protecting the forms and sign-in from abuse; one day')
on conflict (key) do nothing;

-- apply_retention() as in 0078, plus rate_limit_hits.
create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _d integer; _n integer; _out jsonb := '{}'::jsonb;
begin
  select days into _d from public.retention_policies where key = 'email_events' and mode = 'purge';
  if _d is not null then
    delete from public.email_events where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('email_events', _n);
  end if;

  select days into _d from public.retention_policies where key = 'offer_views' and mode = 'purge';
  if _d is not null then
    delete from public.offer_views where viewed_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('offer_views', _n);
  end if;

  select days into _d from public.retention_policies where key = 'campaign_recipients' and mode = 'purge';
  if _d is not null then
    delete from public.crm_campaign_recipients where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('campaign_recipients', _n);
  end if;

  select days into _d from public.retention_policies where key = 'enquiries' and mode = 'purge';
  if _d is not null then
    delete from public.enquiries where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('enquiries', _n);
  end if;

  select days into _d from public.retention_policies where key = 'appointments' and mode = 'purge';
  if _d is not null then
    delete from public.appointments where coalesce(ends_at, starts_at, created_at) < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('appointments', _n);
  end if;

  select days into _d from public.retention_policies where key = 'unconfirmed_signups' and mode = 'purge';
  if _d is not null then
    -- A sign-up that was never confirmed and has nothing else attached.
    delete from public.crm_contacts c
     where c.consent_confirm_token is not null
       and not c.marketing_consent
       and c.consent_confirm_sent_at < now() - make_interval(days => _d)
       and coalesce(array_length(public.contact_legal_holds(c.id), 1), 0) = 0
       and not exists (select 1 from public.enquiries e where e.contact_id = c.id)
       and not exists (select 1 from public.appointments a where a.contact_id = c.id)
       and not exists (select 1 from public.crm_interactions i where i.contact_id = c.id);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('unconfirmed_signups', _n);
  end if;

  select days into _d from public.retention_policies where key = 'activity_log' and mode = 'purge';
  if _d is not null then
    delete from public.activity_log where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('activity_log', _n);
  end if;

  select days into _d from public.retention_policies where key = 'rate_limit_hits' and mode = 'purge';
  if _d is not null then
    delete from public.rate_limit_hits where at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('rate_limit_hits', _n);
  end if;

  return _out || jsonb_build_object('ran_at', now());
end;
$$;
revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

notify pgrst, 'reload schema';
