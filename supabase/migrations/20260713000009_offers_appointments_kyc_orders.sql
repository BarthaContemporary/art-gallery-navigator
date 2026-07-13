-- 0009_offers_appointments_kyc_orders
-- Tokenized offers / fair previews / viewing rooms, appointment booking,
-- AML/KYC (MLR 2017 / HMRC AMP), and future-proofed Stripe orders.

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.offer_kind as enum ('offer', 'fair_preview', 'viewing_room');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.offers (
  id          uuid primary key default gen_random_uuid(),
  kind        public.offer_kind not null default 'offer',
  title       text not null,
  intro       text,               -- personalised greeting/intro copy
  show_prices boolean not null default false,
  expires_at  timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_offers_updated_at on public.offers;
create trigger trg_offers_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

create table if not exists public.offer_items (
  id                 uuid primary key default gen_random_uuid(),
  offer_id           uuid not null references public.offers (id) on delete cascade,
  piece_id           uuid not null references public.pieces (id) on delete cascade,
  price_override_gbp numeric,
  note               text,
  sort_order         int not null default 0,
  unique (offer_id, piece_id)
);

create table if not exists public.offer_recipients (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references public.offers (id) on delete cascade,
  contact_id      uuid not null references public.crm_contacts (id) on delete cascade,
  token           text not null unique default encode(gen_random_bytes(18), 'hex'),
  resend_email_id text,
  sent_at         timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz,
  view_count      int not null default 0,
  response        text,           -- 'interested', 'declined', free text
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (offer_id, contact_id)
);

create table if not exists public.offer_views (
  id           bigint generated always as identity primary key,
  recipient_id uuid not null references public.offer_recipients (id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  ip           inet,
  user_agent   text
);

create index if not exists idx_offer_views_recipient on public.offer_views (recipient_id, viewed_at desc);

-- email_events.offer_recipient_id (declared in 0008) can now be wired up.
alter table public.email_events
  drop constraint if exists email_events_offer_recipient_id_fkey,
  add constraint email_events_offer_recipient_id_fkey
    foreign key (offer_recipient_id) references public.offer_recipients (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Appointments (website /visit booking + studio management)
-- ---------------------------------------------------------------------------
create table if not exists public.appointment_types (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,          -- 'Private gallery viewing', 'Fair meeting'
  duration_minutes int not null default 60,
  location_id      uuid references public.locations (id) on delete set null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table if not exists public.availability_rules (
  id                  uuid primary key default gen_random_uuid(),
  appointment_type_id uuid references public.appointment_types (id) on delete cascade,
  weekday             int not null check (weekday between 0 and 6),  -- 0 = Sunday
  start_time          time not null,
  end_time            time not null,
  created_at          timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid references public.crm_contacts (id) on delete set null,  -- nullable: auto-created on booking
  appointment_type_id uuid references public.appointment_types (id) on delete set null,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  status              text not null default 'requested',
                      -- requested / confirmed / cancelled / completed / no_show
  name                text,
  email               text,
  phone               text,
  notes               text,
  ics_uid             text,       -- stable UID for Proton Calendar ICS invites
  created_at          timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_appointments_starts_at on public.appointments (starts_at);

-- ---------------------------------------------------------------------------
-- AML/KYC (UK Art Market Participant; CDD required >= EUR 10k transactions)
-- ---------------------------------------------------------------------------
create table if not exists public.kyc_profiles (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null unique references public.crm_contacts (id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'verified', 'refer', 'rejected')),
  risk_rating  text check (risk_rating in ('low', 'medium', 'high')),
  verified_at  timestamptz,
  expires_at   timestamptz,        -- re-verification due date
  provider     text,               -- 'sumsub', 'complyadvantage', ...
  provider_ref text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_kyc_profiles_updated_at on public.kyc_profiles;
create trigger trg_kyc_profiles_updated_at
  before update on public.kyc_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.kyc_checks (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.kyc_profiles (id) on delete cascade,
  check_type        text not null
                    check (check_type in ('identity', 'pep', 'sanctions', 'adverse_media')),
  provider          text,
  provider_check_id text,
  result            text,          -- 'clear', 'consider', 'refer', ...
  raw_result        jsonb,
  checked_at        timestamptz not null default now()
);

create index if not exists idx_kyc_checks_profile on public.kyc_checks (profile_id, checked_at desc);

-- ID / proof-of-address documents. Strict admin-only RLS; MLR retention
-- (5 years) is a legal hold exempted from GDPR hard-delete routines.
create table if not exists public.kyc_documents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.kyc_profiles (id) on delete cascade,
  doc_type     text,               -- 'passport', 'driving_licence', 'proof_of_address', ...
  storage_path text not null,      -- kyc-documents/<profile>/<file>
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders (Stripe purchases, Phase 6 — schema created now so offers can carry
-- a Purchase action later without a schema change)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                         uuid primary key default gen_random_uuid(),
  contact_id                 uuid references public.crm_contacts (id) on delete set null,
  status                     text not null default 'pending'
                             check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  currency                   text not null default 'GBP',
  subtotal_gbp               numeric,
  vat_gbp                    numeric,
  total_gbp                  numeric,
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  piece_id         uuid not null references public.pieces (id) on delete restrict,
  agreed_price_gbp numeric,
  vat_treatment    public.vat_treatment,   -- snapshot at time of sale
  created_at       timestamptz not null default now(),
  unique (order_id, piece_id)
);
