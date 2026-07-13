-- 0005_financials
-- Financials in a separate 1:1 table so that RLS can hide them from staff
-- entirely (row-level, not column-level). Also FX rates.
--
-- Forward references (added later via ALTER TABLE once the targets exist):
--   purchase_invoice_document_id / sale_invoice_document_id -> piece_documents (0006)
--   seller_contact_id / buyer_contact_id                    -> crm_contacts   (0008)
--   consignment_id                                          -> consignments   (0007)

do $$
begin
  create type public.vat_treatment as enum
    ('margin_scheme', 'standard', 'zero_rated', 'outside_scope');
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exchange rates (manual or imported), keyed by pair + date
-- ---------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  base  text not null,          -- e.g. 'USD'
  quote text not null,          -- e.g. 'GBP'
  rate  numeric not null,
  as_of date not null,
  primary key (base, quote, as_of)
);

-- ---------------------------------------------------------------------------
-- Piece financials (1:1 with pieces)
-- ---------------------------------------------------------------------------
create table if not exists public.piece_financials (
  piece_id                     uuid primary key
                               references public.pieces (id) on delete cascade,

  -- Purchase side
  purchase_date                date,
  purchase_cost                numeric,
  purchase_currency            text not null default 'GBP',
  purchase_fx                  numeric not null default 1,
  purchase_cost_gbp            numeric,
  purchase_invoice_document_id uuid,   -- FK added in 0006
  seller_contact_id            uuid,   -- FK added in 0008
  restoration_cost_gbp         numeric not null default 0,
  other_costs_gbp              numeric not null default 0,
  total_cost_gbp               numeric generated always as (
                                 coalesce(purchase_cost_gbp, 0)
                                 + coalesce(restoration_cost_gbp, 0)
                                 + coalesce(other_costs_gbp, 0)
                               ) stored,

  -- Pricing / sale side
  marked_price_gbp             numeric,
  sold_date                    date,
  sold_price                   numeric,
  sell_currency                text not null default 'GBP',
  sell_fx                      numeric not null default 1,
  sold_price_gbp               numeric,
  sale_invoice_document_id     uuid,   -- FK added in 0006
  buyer_contact_id             uuid,   -- FK added in 0008

  -- VAT (mixed per-item: margin scheme + standard; HMRC Notice 718)
  vat_treatment                public.vat_treatment not null default 'margin_scheme',
  vat_review_needed            boolean not null default false,

  consignment_id               uuid,   -- FK added in 0007

  -- margin_pct is computed in views (avoids div-by-zero in a stored column)
  margin_gbp                   numeric generated always as (
                                 sold_price_gbp
                                 - coalesce(purchase_cost_gbp, 0)
                                 - coalesce(restoration_cost_gbp, 0)
                                 - coalesce(other_costs_gbp, 0)
                               ) stored,

  updated_at                   timestamptz not null default now()
);

drop trigger if exists trg_piece_financials_updated_at on public.piece_financials;
create trigger trg_piece_financials_updated_at
  before update on public.piece_financials
  for each row execute function public.set_updated_at();

create index if not exists idx_piece_financials_sold_date     on public.piece_financials (sold_date);
create index if not exists idx_piece_financials_purchase_date on public.piece_financials (purchase_date);
create index if not exists idx_piece_financials_vat           on public.piece_financials (vat_treatment);

-- ---------------------------------------------------------------------------
-- Auto-create an empty financials row for every new piece.
-- SECURITY DEFINER: staff can insert pieces but have no RLS policy at all on
-- piece_financials, so the trigger must run with elevated rights.
-- ---------------------------------------------------------------------------
create or replace function public.create_piece_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.piece_financials (piece_id)
  values (new.id)
  on conflict (piece_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_pieces_create_financials on public.pieces;
create trigger trg_pieces_create_financials
  after insert on public.pieces
  for each row execute function public.create_piece_financials();
