-- 0003_inventory_core
-- Core inventory: makers, categories, locations, pieces.
-- Financials live in a separate 1:1 table (0005) so financial visibility is
-- row-level RLS, not column hacks.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.piece_status as enum
    ('in_stock', 'reserved', 'consigned_in', 'consigned_out',
     'sold', 'gifted', 'returned', 'written_off');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.location_type as enum
    ('gallery', 'storage', 'fair', 'restorer', 'consignee', 'auction', 'other');
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Makers (artists / workshops), with CJK + romanized + alternate names
-- ---------------------------------------------------------------------------
create table if not exists public.makers (
  id                 uuid primary key default gen_random_uuid(),
  display_name       text not null,
  native_name        text,          -- CJK original
  romanized_name     text,          -- e.g. "Unno Shōmin"
  alt_names          text[] not null default '{}',
  school_or_workshop text,
  life_dates         text,          -- fuzzy, e.g. "1844-1915" or "active Meiji"
  region             text,
  biography          text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_makers_updated_at on public.makers;
create trigger trg_makers_updated_at
  before update on public.makers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categories: hierarchical (Japan > Metalwork, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  parent_id  uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Locations (gallery shelves, storage, fairs, restorers, consignees...)
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,      -- e.g. "SJ-B2"
  name       text,
  type       public.location_type not null default 'storage',
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pieces (the stock records)
-- ---------------------------------------------------------------------------
create table if not exists public.pieces (
  id                           uuid primary key default gen_random_uuid(),

  -- Stock numbering: trigger-assigned YYYY-NNNN (0004). Legacy FileMaker
  -- numbers are preserved verbatim, non-unique (54 known duplicates).
  stock_number                 text not null unique,
  legacy_stock_number          text,
  legacy_stock_number_conflict boolean not null default false,

  title                        text,
  maker_id                     uuid references public.makers (id) on delete set null,
  attribution_qualifier        text,   -- "attributed to", "school of", ...
  category_id                  uuid references public.categories (id) on delete set null,
  medium                       text,
  period                       text,   -- e.g. "Meiji (1868-1912)"
  origin_region                text,
  description                  text,
  condition_report             text,
  signature_inscription        text,

  -- Tomobako (storage box) details
  box_type                     text,
  box_notes                    text,

  -- Dimensions: parsed numerics + verbatim legacy fallback
  height_cm                    numeric,
  width_cm                     numeric,
  depth_cm                     numeric,
  length_cm                    numeric,
  diameter_cm                  numeric,
  weight_g                     numeric,
  dimensions_display           text,

  status                       public.piece_status not null default 'in_stock',
  location_id                  uuid references public.locations (id) on delete set null,
  photographer                 text,
  comments                     text,
  tags                         text[] not null default '{}',
  ai_suggestions               jsonb,  -- vision-model proposals, review-and-accept only
  web_visible                  boolean not null default false,

  created_by                   uuid references auth.users (id) on delete set null,
  updated_by                   uuid references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);

drop trigger if exists trg_pieces_updated_at on public.pieces;
create trigger trg_pieces_updated_at
  before update on public.pieces
  for each row execute function public.set_updated_at();

-- Common filter/join indexes
create index if not exists idx_pieces_maker_id     on public.pieces (maker_id);
create index if not exists idx_pieces_category_id  on public.pieces (category_id);
create index if not exists idx_pieces_location_id  on public.pieces (location_id);
create index if not exists idx_pieces_status       on public.pieces (status);
create index if not exists idx_pieces_web_visible  on public.pieces (web_visible) where web_visible;
create index if not exists idx_pieces_tags         on public.pieces using gin (tags);
create index if not exists idx_pieces_legacy_no    on public.pieces (legacy_stock_number);
