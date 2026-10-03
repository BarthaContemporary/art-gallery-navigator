-- ---------------------------------------------------------------------------
-- 0078 — data protection tooling (UK GDPR / DPA 2018 / PECR / MLR 2017).
--
--   • crm_contacts: evidence of consent (what was shown, when, from where),
--     double-opt-in confirmation token, bounce suppression, erasure stamp.
--   • retention_policies: one row per data class, days to keep, editable in
--     Admin → Data protection; apply_retention() enforces them (daily cron).
--   • dp_requests: register of data-subject requests (access, erasure, …)
--     with the statutory one-month due date.
--   • dp_breach_log: the breach register Art. 33(5) requires, whether or not
--     a breach is reportable.
--   • erase_contact(): the right-to-erasure routine. Hard-deletes a contact
--     with no legal hold; where MLR (5 years after the relationship) or
--     tax/accounting records (6 years) apply, pseudonymises the row and
--     scrubs everything that is not under hold, keeping the links the
--     retained records need.
-- Idempotent; safe to re-run.
-- ---------------------------------------------------------------------------

alter table public.crm_contacts
  add column if not exists consent_evidence     jsonb,
  add column if not exists consent_confirm_token text,
  add column if not exists consent_confirm_sent_at timestamptz,
  add column if not exists email_bounced_at     timestamptz,
  add column if not exists erased_at            timestamptz;
create unique index if not exists idx_crm_contacts_confirm_token
  on public.crm_contacts (consent_confirm_token) where consent_confirm_token is not null;

-- ---- retention policies ----------------------------------------------------
create table if not exists public.retention_policies (
  key          text primary key,
  label        text not null,
  days         integer not null check (days > 0),
  mode         text not null default 'purge' check (mode in ('purge', 'review')),
  basis        text,
  updated_at   timestamptz not null default now()
);
insert into public.retention_policies (key, label, days, mode, basis) values
  ('email_events',        'Email delivery events (opens, clicks, bounces)',       730,  'purge',  'Legitimate interest — proving delivery and handling complaints; two years'),
  ('offer_views',         'Private-offer page views (IP, browser)',               730,  'purge',  'Legitimate interest — security of private links; two years'),
  ('campaign_recipients', 'Newsletter send records per contact',                 1095, 'purge',  'Evidence of PECR compliance for three years after a send'),
  ('enquiries',           'Website enquiries',                                   1095, 'purge',  'Contract / pre-contract steps; three years after the enquiry'),
  ('appointments',        'Appointment bookings',                                730,  'purge',  'Contract; two years after the appointment'),
  ('unconfirmed_signups', 'Newsletter sign-ups never confirmed',                 30,   'purge',  'Consent not completed — the record has no basis to stay'),
  ('activity_log',        'Studio change history',                               2190, 'purge',  'Accounting and provenance records; six years'),
  ('inactive_contacts',   'Contacts with no activity, no consent and no hold',   1825, 'review', 'Reviewed for deletion after five years — never deleted automatically'),
  ('kyc_records',         'AML due-diligence records after the relationship ends', 1825, 'review', 'MLR 2017 reg. 40 — five years, then reviewed for deletion')
on conflict (key) do nothing;

alter table public.retention_policies enable row level security;
drop policy if exists admin_all on public.retention_policies;
create policy admin_all on public.retention_policies
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.retention_policies from anon;

-- ---- data-subject request register ------------------------------------------
create table if not exists public.dp_requests (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid references public.crm_contacts (id) on delete set null,
  subject_name  text,
  kind          text not null check (kind in ('access','erasure','rectification','restriction','objection','portability','withdraw_consent','other')),
  channel       text,
  received_at   date not null default current_date,
  due_at        date not null default (current_date + interval '1 month')::date,
  completed_at  timestamptz,
  outcome       text,
  notes         text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
alter table public.dp_requests enable row level security;
drop policy if exists admin_all on public.dp_requests;
create policy admin_all on public.dp_requests
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.dp_requests from anon;

-- ---- breach register --------------------------------------------------------
create table if not exists public.dp_breach_log (
  id                  uuid primary key default gen_random_uuid(),
  occurred_at         timestamptz,
  discovered_at       timestamptz not null default now(),
  description         text not null,
  data_affected       text,
  people_affected     integer,
  likely_risk         text check (likely_risk in ('unlikely','possible','likely','high')),
  reported_to_ico     boolean not null default false,
  reported_at         timestamptz,
  subjects_notified   boolean not null default false,
  actions_taken       text,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
alter table public.dp_breach_log enable row level security;
drop policy if exists admin_all on public.dp_breach_log;
create policy admin_all on public.dp_breach_log
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.dp_breach_log from anon;

-- ---- legal holds ------------------------------------------------------------
-- Why a contact cannot be hard-deleted. Empty array = no hold.
create or replace function public.contact_legal_holds(_contact uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select array_remove(array[
    case when exists (select 1 from public.piece_financials f where f.buyer_contact_id = _contact or f.seller_contact_id = _contact)
         then 'Purchase or sale record (tax and accounting records, six years)' end,
    case when exists (select 1 from public.consignments k where k.counterparty_contact_id = _contact)
         then 'Consignment agreement (accounting records, six years)' end,
    case when exists (select 1 from public.orders o where o.contact_id = _contact)
         then 'Order record (accounting records, six years)' end,
    case when exists (select 1 from public.pieces p where p.consignee_contact_id = _contact)
           or exists (select 1 from public.external_pieces e where e.consignee_contact_id = _contact)
         then 'Named as consignee on stock (accounting records)' end,
    case when exists (select 1 from public.kyc_profiles k where k.contact_id = _contact)
         then 'Anti-money-laundering due diligence (MLR 2017, five years after the relationship ends)' end
  ], null);
$$;
grant execute on function public.contact_legal_holds(uuid) to authenticated, service_role;

-- ---- erasure ----------------------------------------------------------------
create or replace function public.erase_contact(_contact uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _holds text[];
begin
  if not public.has_role(auth.uid(), 'admin') and current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Only an admin can erase a contact';
  end if;
  if not exists (select 1 from public.crm_contacts where id = _contact) then
    return jsonb_build_object('mode', 'missing');
  end if;

  _holds := public.contact_legal_holds(_contact);

  -- Everything that is personal and not under hold goes, in either mode.
  delete from public.crm_interactions where contact_id = _contact;
  delete from public.crm_list_members where contact_id = _contact;
  delete from public.crm_campaign_recipients where contact_id = _contact;
  delete from public.unsubscribe_tokens where contact_id = _contact;
  delete from public.offer_recipients where contact_id = _contact;
  update public.appointments set contact_id = null, name = 'Erased', email = null, phone = null, notes = null where contact_id = _contact;
  update public.enquiries set contact_id = null, message = '[erased at the data subject''s request]' where contact_id = _contact;
  delete from public.activity_log where entity_type = 'crm_contacts' and entity_id = _contact;

  if coalesce(array_length(_holds, 1), 0) = 0 then
    delete from public.crm_contacts where id = _contact;
    return jsonb_build_object('mode', 'deleted', 'holds', '[]'::jsonb);
  end if;

  -- Under hold: pseudonymise. The row stays so the retained accounting and
  -- AML records keep their reference; nothing identifying remains on it.
  update public.crm_contacts set
    first_name = 'Erased contact',
    last_name = left(_contact::text, 8),
    salutation = null,
    email = null, phone = null,
    address_line1 = null, address_line2 = null, city = null, postcode = null, country = null,
    instagram_handle = null, whatsapp_number = null, line_id = null, wechat_id = null,
    tags = '{}', interested_regions = '{}', custom_fields = '{}'::jsonb, notes = null,
    marketing_consent = false, consent_evidence = null, consent_confirm_token = null,
    do_not_mail = true, unsubscribed_at = coalesce(unsubscribed_at, now()),
    erased_at = now()
  where id = _contact;
  return jsonb_build_object('mode', 'anonymised', 'holds', to_jsonb(_holds));
end;
$$;
revoke all on function public.erase_contact(uuid) from public, anon;
grant execute on function public.erase_contact(uuid) to authenticated, service_role;

-- ---- retention enforcement ----------------------------------------------------
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

  return _out || jsonb_build_object('ran_at', now());
end;
$$;
revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

-- Contacts due for a human review (never auto-deleted): no consent, no hold,
-- nothing attached, and untouched for the configured period.
create or replace view public.vw_contacts_for_review as
  select c.id, c.first_name, c.last_name, c.email, c.updated_at, c.created_at
  from public.crm_contacts c
  cross join (select days from public.retention_policies where key = 'inactive_contacts') p
  where c.erased_at is null
    and not c.marketing_consent
    and c.updated_at < now() - make_interval(days => p.days)
    and coalesce(array_length(public.contact_legal_holds(c.id), 1), 0) = 0
    and not exists (select 1 from public.crm_interactions i where i.contact_id = c.id and i.happened_at > now() - make_interval(days => p.days))
    and not exists (select 1 from public.enquiries e where e.contact_id = c.id and e.created_at > now() - make_interval(days => p.days))
    and not exists (select 1 from public.appointments a where a.contact_id = c.id and a.created_at > now() - make_interval(days => p.days));

notify pgrst, 'reload schema';
