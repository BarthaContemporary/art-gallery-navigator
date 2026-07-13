-- 0008_crm
-- Contacts, organizations, interactions, lists, campaigns, email events,
-- unsubscribe tokens. Also resolves the contact FKs declared earlier
-- (piece_financials, consignments, enquiries).

-- ---------------------------------------------------------------------------
-- Organizations (museums, auction houses, shippers, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  org_type      text,             -- 'museum', 'auction_house', 'dealer', 'shipper', ...
  website       text,
  address_line1 text,
  address_line2 text,
  city          text,
  postcode      text,
  country       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_crm_organizations_updated_at on public.crm_organizations;
create trigger trg_crm_organizations_updated_at
  before update on public.crm_organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
create table if not exists public.crm_contacts (
  id                 uuid primary key default gen_random_uuid(),
  first_name         text,
  last_name          text,
  salutation         text,        -- "Dear Professor Tanaka"
  organization_id    uuid references public.crm_organizations (id) on delete set null,
  contact_type       text not null default 'collector',
                     -- collector / museum / dealer / auction_house / shipper / restorer / press

  -- Channels
  email              text,
  phone              text,
  address_line1      text,
  address_line2      text,
  city               text,
  postcode           text,
  country            text,
  instagram_handle   text,
  whatsapp_number    text,
  line_id            text,
  wechat_id          text,

  -- Segmentation
  tags               text[] not null default '{}',
  interested_regions text[] not null default '{}',
  custom_fields      jsonb not null default '{}',

  -- UK GDPR: consent + provenance of consent, suppression flags
  marketing_consent  boolean not null default false,
  consent_date       timestamptz,
  consent_source     text,        -- 'csv_import_legitimate_interest', 'signup_form', ...
  do_not_mail        boolean not null default false,
  unsubscribed_at    timestamptz,

  -- AML/KYC summary (detail in kyc_profiles / kyc_checks, 0009)
  kyc_status         text not null default 'not_started'
                     check (kyc_status in ('not_started', 'pending', 'verified', 'refer', 'rejected')),
  sanctions_status   text,
  last_screened_at   timestamptz,

  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_crm_contacts_updated_at on public.crm_contacts;
create trigger trg_crm_contacts_updated_at
  before update on public.crm_contacts
  for each row execute function public.set_updated_at();

create index if not exists idx_crm_contacts_email        on public.crm_contacts (lower(email));
create index if not exists idx_crm_contacts_organization on public.crm_contacts (organization_id);
create index if not exists idx_crm_contacts_tags         on public.crm_contacts using gin (tags);

-- Resolve contact FKs declared earlier (created before crm_contacts existed).
alter table public.piece_financials
  drop constraint if exists piece_financials_seller_contact_id_fkey,
  add constraint piece_financials_seller_contact_id_fkey
    foreign key (seller_contact_id) references public.crm_contacts (id) on delete set null;

alter table public.piece_financials
  drop constraint if exists piece_financials_buyer_contact_id_fkey,
  add constraint piece_financials_buyer_contact_id_fkey
    foreign key (buyer_contact_id) references public.crm_contacts (id) on delete set null;

alter table public.consignments
  drop constraint if exists consignments_counterparty_contact_id_fkey,
  add constraint consignments_counterparty_contact_id_fkey
    foreign key (counterparty_contact_id) references public.crm_contacts (id) on delete set null;

alter table public.enquiries
  drop constraint if exists enquiries_contact_id_fkey,
  add constraint enquiries_contact_id_fkey
    foreign key (contact_id) references public.crm_contacts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Interactions (calls, meetings, emails, fair conversations)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_interactions (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.crm_contacts (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  kind        text,               -- 'call', 'email', 'meeting', 'fair', 'note'
  note        text,
  happened_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_crm_interactions_contact
  on public.crm_interactions (contact_id, happened_at desc);

-- ---------------------------------------------------------------------------
-- Lists (mailing / segmentation)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_crm_lists_updated_at on public.crm_lists;
create trigger trg_crm_lists_updated_at
  before update on public.crm_lists
  for each row execute function public.set_updated_at();

create table if not exists public.crm_list_members (
  list_id    uuid not null references public.crm_lists (id) on delete cascade,
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- Campaigns (newsletters via Resend; list truth stays in this DB)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  subject             text,
  template_key        text,              -- react-email template identifier
  status              text not null default 'draft',
  resend_broadcast_id text,
  sent_at             timestamptz,
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists trg_crm_campaigns_updated_at on public.crm_campaigns;
create trigger trg_crm_campaigns_updated_at
  before update on public.crm_campaigns
  for each row execute function public.set_updated_at();

create table if not exists public.crm_campaign_recipients (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.crm_campaigns (id) on delete cascade,
  contact_id      uuid not null references public.crm_contacts (id) on delete cascade,
  resend_email_id text,
  status          text not null default 'pending',
  opened_at       timestamptz,
  clicked_at      timestamptz,
  bounced_at      timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- Raw provider events (Resend webhooks) — audit + reprocessing.
-- offer_recipient_id FK is added in 0009 once offer_recipients exists.
-- ---------------------------------------------------------------------------
create table if not exists public.email_events (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null default 'resend',
  event_type             text not null,
  payload                jsonb not null,
  campaign_recipient_id  uuid references public.crm_campaign_recipients (id) on delete set null,
  offer_recipient_id     uuid,        -- FK added in 0009
  created_at             timestamptz not null default now()
);

create index if not exists idx_email_events_type on public.email_events (event_type, created_at desc);

-- ---------------------------------------------------------------------------
-- Unsubscribe tokens (List-Unsubscribe + tokened page)
-- ---------------------------------------------------------------------------
create table if not exists public.unsubscribe_tokens (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);
