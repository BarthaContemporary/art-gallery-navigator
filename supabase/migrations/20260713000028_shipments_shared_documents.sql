-- ---------------------------------------------------------------------------
-- Import/export shipments + shared (many-to-many) documents.
--
-- Shipments group an import or export event (date, reference, one or more
-- files) and link to many pieces — one import and one export per piece.
-- Documents become shareable: one file/date/reference can cover many pieces
-- via document_pieces, instead of a copy per piece.
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.shipment_kind as enum ('import', 'export');
exception when duplicate_object then null; end $$;

create table if not exists public.shipments (
  id            uuid primary key default gen_random_uuid(),
  kind          public.shipment_kind not null,
  shipment_date date,
  reference     text,
  notes         text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_shipments_updated_at on public.shipments;
create trigger trg_shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

-- Files attached to a shipment (import declaration, packing list, …).
create table if not exists public.shipment_documents (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments (id) on delete cascade,
  title        text,
  storage_path text not null,          -- private piece-documents bucket, shipments/<id>/<file>
  created_at   timestamptz not null default now()
);
create index if not exists idx_shipment_documents_shipment on public.shipment_documents (shipment_id);

-- Piece ↔ shipment link. kind is denormalised so a piece can hold at most one
-- import and one export (the partial unique index below).
create table if not exists public.piece_shipments (
  piece_id    uuid not null references public.pieces (id) on delete cascade,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  kind        public.shipment_kind not null,
  created_at  timestamptz not null default now(),
  primary key (piece_id, shipment_id)
);
create unique index if not exists uq_piece_shipment_kind on public.piece_shipments (piece_id, kind);
create index if not exists idx_piece_shipments_shipment on public.piece_shipments (shipment_id);

-- ---------------------------------------------------------------------------
-- Shared documents: piece_documents becomes the document record (piece_id now
-- optional / legacy) and document_pieces holds the many-to-many links.
-- ---------------------------------------------------------------------------
alter table public.piece_documents
  add column if not exists doc_date  date,
  add column if not exists reference text;
alter table public.piece_documents alter column piece_id drop not null;

create table if not exists public.document_pieces (
  document_id uuid not null references public.piece_documents (id) on delete cascade,
  piece_id    uuid not null references public.pieces (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (document_id, piece_id)
);
create index if not exists idx_document_pieces_piece on public.document_pieces (piece_id);

-- Backfill: every existing single-piece document becomes a link.
insert into public.document_pieces (document_id, piece_id)
  select id, piece_id from public.piece_documents where piece_id is not null
  on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS: staff manage; accountant reads (needed for the stock book joins).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['shipments', 'shipment_documents', 'piece_shipments', 'document_pieces']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_all on public.%I', t);
    execute format($f$create policy admin_all on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'))$f$, t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format($f$create policy staff_all on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'staff')) with check (public.has_role(auth.uid(), 'staff'))$f$, t);
    execute format('drop policy if exists accountant_select on public.%I', t);
    execute format($f$create policy accountant_select on public.%I for select to authenticated
      using (public.has_role(auth.uid(), 'accountant'))$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Stock book: expose import + export date/reference per piece.
-- ---------------------------------------------------------------------------
create or replace view public.vw_stock_book
with (security_invoker = true) as
select
  p.id                                as piece_id,
  p.stock_number,
  f.purchase_date,
  f.purchase_invoice_document_id,
  trim(concat_ws(' ', sc.first_name, sc.last_name)) as seller_name,
  p.title || coalesce(' — ' || p.medium, '') as description,
  f.purchase_cost_gbp,
  f.sold_date,
  f.sale_invoice_document_id,
  f.sold_price_gbp,
  f.margin_gbp,
  round(greatest(coalesce(f.margin_gbp, 0), 0) / 6, 2) as vat_due_gbp,
  case
    when coalesce(f.total_cost_gbp, 0) <> 0 and f.sold_price_gbp is not null
    then round(f.margin_gbp / f.total_cost_gbp * 100, 1)
  end                                 as margin_pct,
  imps.shipment_date                  as import_date,
  imps.reference                      as import_reference,
  exps.shipment_date                  as export_date,
  exps.reference                      as export_reference
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
left join public.piece_shipments imp on imp.piece_id = p.id and imp.kind = 'import'
left join public.shipments imps on imps.id = imp.shipment_id
left join public.piece_shipments exp on exp.piece_id = p.id and exp.kind = 'export'
left join public.shipments exps on exps.id = exp.shipment_id
where f.vat_treatment = 'margin_scheme';

create or replace view public.vw_stock_book_standard
with (security_invoker = true) as
select
  p.id                                as piece_id,
  p.stock_number,
  f.purchase_date,
  f.purchase_invoice_document_id,
  trim(concat_ws(' ', sc.first_name, sc.last_name)) as seller_name,
  p.title || coalesce(' — ' || p.medium, '') as description,
  f.purchase_cost_gbp,
  f.sold_date,
  f.sale_invoice_document_id,
  f.sold_price_gbp,
  round(coalesce(f.sold_price_gbp, 0) / 6, 2) as vat_due_gbp,
  f.margin_gbp,
  imps.shipment_date                  as import_date,
  imps.reference                      as import_reference,
  exps.shipment_date                  as export_date,
  exps.reference                      as export_reference
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
left join public.piece_shipments imp on imp.piece_id = p.id and imp.kind = 'import'
left join public.shipments imps on imps.id = imp.shipment_id
left join public.piece_shipments exp on exp.piece_id = p.id and exp.kind = 'export'
left join public.shipments exps on exps.id = exp.shipment_id
where f.vat_treatment = 'standard';

notify pgrst, 'reload schema';
