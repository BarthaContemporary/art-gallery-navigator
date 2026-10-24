-- 0096_review_followups
-- Loose ends from the security review fixes (2026-10), applied after
-- 0089–0095.
--
-- 1. vw_anon_exposure (0057) lists which tables the anonymous role can reach.
--    It is metadata only, but every signed-in user could read it; like the
--    newer vw_function_exposure (0093) it is now for the service role only.
-- 2. The retention job also clears the short-lived security records the
--    fixes added (expired upload slips and passkey challenges, which hold a
--    staff user id) and newsletter confirmations asked for on an existing
--    contact's behalf whose link has expired (0095's marketing_pending).
--    Each gets a retention_policies row, per the CLAUDE.md personal-data rule.

revoke all on public.vw_anon_exposure from public, anon, authenticated;
grant select on public.vw_anon_exposure to service_role;

insert into public.retention_policies (key, label, days, mode, basis) values
  ('security_tokens', 'Expired upload slips and passkey challenges (staff user ids)', 1, 'purge',
   'Legitimate interest — securing uploads and passkey sign-in; useless once expired'),
  ('pending_optins', 'Unconfirmed newsletter requests on existing contacts', 30, 'purge',
   'Consent — a request whose confirmation link has expired is dropped')
on conflict (key) do nothing;

-- apply_retention() as in 0089, plus the two sweeps above.
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

  -- Short-lived security records: unclaimed upload slips (0090), unused
  -- passkey challenges (0092). Each is useless once expired; the routes
  -- clear them as they go, this catches what an abandoned flow left.
  select days into _d from public.retention_policies where key = 'security_tokens' and mode = 'purge';
  if _d is not null then
    delete from public.pending_uploads where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_uploads', _n);
    delete from public.webauthn_challenges where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('webauthn_challenges', _n);
  end if;

  -- A newsletter confirmation asked for on an existing contact's behalf and
  -- never confirmed (0095): its link has expired, so the pending entry goes.
  select days into _d from public.retention_policies where key = 'pending_optins' and mode = 'purge';
  if _d is not null then
    update public.crm_contacts
       set consent_evidence = consent_evidence - 'marketing_pending'
     where consent_evidence ? 'marketing_pending'
       and coalesce((consent_evidence -> 'marketing_pending' ->> 'at')::timestamptz, '-infinity'::timestamptz)
           < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_optins', _n);
  end if;

  return _out || jsonb_build_object('ran_at', now());
end;
$$;
revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

notify pgrst, 'reload schema';
