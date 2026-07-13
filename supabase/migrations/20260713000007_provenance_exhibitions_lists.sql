-- 0007_provenance_exhibitions_lists
-- Provenance timeline, exhibitions, consignments, enquiries, watches,
-- and custom piece lists (static + saved-view filter rules).

-- ---------------------------------------------------------------------------
-- Provenance entries (fuzzy dates; is_public gates website display)
-- ---------------------------------------------------------------------------
create table if not exists public.provenance_entries (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid not null references public.pieces (id) on delete cascade,
  sort_order int not null default 0,
  date_text  text,               -- "c. 1900", "Meiji era", "1985-2003"
  party      text,               -- collection / person / auction house
  event_type text check (event_type in
               ('acquired', 'collection', 'auction', 'exhibited', 'published', 'other')),
  details    text,
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_provenance_piece on public.provenance_entries (piece_id, sort_order);

-- ---------------------------------------------------------------------------
-- Exhibitions
-- ---------------------------------------------------------------------------
create table if not exists public.exhibitions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  venue      text,
  start_date date,
  end_date   date,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.piece_exhibitions (
  piece_id      uuid not null references public.pieces (id) on delete cascade,
  exhibition_id uuid not null references public.exhibitions (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (piece_id, exhibition_id)
);

-- ---------------------------------------------------------------------------
-- Consignments (in = we hold someone else's stock; out = ours elsewhere)
-- counterparty_contact_id FK is added in 0008 once crm_contacts exists.
-- ---------------------------------------------------------------------------
create table if not exists public.consignments (
  id                      uuid primary key default gen_random_uuid(),
  direction               text not null check (direction in ('in', 'out')),
  counterparty_contact_id uuid,     -- FK added in 0008
  start_date              date,
  end_date                date,
  revenue_split_pct       numeric,  -- our share, e.g. 40 = 40%
  terms                   text,
  created_at              timestamptz not null default now()
);

create table if not exists public.consignment_items (
  id               uuid primary key default gen_random_uuid(),
  consignment_id   uuid not null references public.consignments (id) on delete cascade,
  piece_id         uuid not null references public.pieces (id) on delete cascade,
  agreed_price_gbp numeric,
  created_at       timestamptz not null default now(),
  unique (consignment_id, piece_id)
);

-- piece_financials.consignment_id (declared in 0005) can now point here.
alter table public.piece_financials
  drop constraint if exists piece_financials_consignment_id_fkey,
  add constraint piece_financials_consignment_id_fkey
    foreign key (consignment_id)
    references public.consignments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Enquiries (from offers / website / walk-in); contact FK added in 0008
-- ---------------------------------------------------------------------------
create table if not exists public.enquiries (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid references public.pieces (id) on delete set null,
  contact_id uuid,                 -- FK added in 0008
  channel    text,                 -- 'offer', 'website', 'email', 'phone', 'fair'
  message    text,
  status     text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_enquiries_piece on public.enquiries (piece_id);

-- ---------------------------------------------------------------------------
-- Watches (the design's watch toggle) — per-user
-- ---------------------------------------------------------------------------
create table if not exists public.piece_watches (
  user_id    uuid not null references auth.users (id) on delete cascade,
  piece_id   uuid not null references public.pieces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

-- ---------------------------------------------------------------------------
-- Custom piece lists: static membership or dynamic jsonb filter rules
-- (saved views). Dynamic rule evaluation happens in the app.
-- ---------------------------------------------------------------------------
create table if not exists public.piece_lists (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  is_dynamic   boolean not null default false,
  filter_rules jsonb,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_piece_lists_updated_at on public.piece_lists;
create trigger trg_piece_lists_updated_at
  before update on public.piece_lists
  for each row execute function public.set_updated_at();

create table if not exists public.piece_list_items (
  list_id    uuid not null references public.piece_lists (id) on delete cascade,
  piece_id   uuid not null references public.pieces (id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  primary key (list_id, piece_id)
);
