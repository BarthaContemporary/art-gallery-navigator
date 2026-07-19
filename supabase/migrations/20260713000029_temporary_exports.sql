-- ---------------------------------------------------------------------------
-- Temporary exports (carnets for fairs/exhibitions abroad).
--   * a third shipment kind: 'temporary_export' (enum value added separately)
--   * many-per-piece (a work can go out repeatedly), so the one-per-kind unique
--     index is narrowed to import/export only
--   * the return is tracked PER ITEM on the link (returned_at), with a
--     closed_reason for items that left permanently / were written off abroad
-- ---------------------------------------------------------------------------

alter table public.piece_shipments
  add column if not exists returned_at   date,
  add column if not exists closed_reason text;   -- 'written_off' | 'exported' when not returned

-- One import + one export per piece stays enforced; temporary exports are
-- unlimited per piece.
drop index if exists public.uq_piece_shipment_kind;
create unique index if not exists uq_piece_shipment_kind
  on public.piece_shipments (piece_id, kind)
  where kind in ('import', 'export');

-- ---------------------------------------------------------------------------
-- vw_pieces_list: add on_temp_export flag (out now, not yet returned/closed).
-- ---------------------------------------------------------------------------
create or replace view public.vw_pieces_list
with (security_invoker = true) as
select
  p.id,
  p.stock_number,
  p.legacy_stock_number,
  p.legacy_stock_number_conflict,
  p.title,
  p.maker_id,
  m.display_name  as maker_name,
  p.category_id,
  c.name          as category_name,
  p.medium,
  p.period,
  p.origin_region,
  p.status,
  p.location_id,
  l.code          as location_code,
  p.web_visible,
  p.tags,
  (select pi.id
     from public.piece_images pi
    where pi.piece_id = p.id
    order by (pi.role <> 'front'), pi.sort_order, pi.created_at
    limit 1)      as primary_image_id,
  f.marked_price_gbp,
  case
    when f.purchase_date is not null
    then coalesce(f.sold_date, now()::date) - f.purchase_date
  end             as days_in_stock,
  p.created_at,
  p.updated_at,
  exists (
    select 1 from public.piece_shipments ps
    where ps.piece_id = p.id and ps.kind = 'temporary_export'
      and ps.returned_at is null and ps.closed_reason is null
  )               as on_temp_export
from public.pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

-- ---------------------------------------------------------------------------
-- Stock book: add the currently-open temporary export (date + reference).
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
  exps.reference                      as export_reference,
  tmp.shipment_date                   as temp_export_date,
  tmp.reference                       as temp_export_reference
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
left join public.piece_shipments imp on imp.piece_id = p.id and imp.kind = 'import'
left join public.shipments imps on imps.id = imp.shipment_id
left join public.piece_shipments exp on exp.piece_id = p.id and exp.kind = 'export'
left join public.shipments exps on exps.id = exp.shipment_id
left join lateral (
  select s.shipment_date, s.reference
  from public.piece_shipments ps join public.shipments s on s.id = ps.shipment_id
  where ps.piece_id = p.id and ps.kind = 'temporary_export'
    and ps.returned_at is null and ps.closed_reason is null
  order by s.shipment_date desc nulls last
  limit 1
) tmp on true
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
  exps.reference                      as export_reference,
  tmp.shipment_date                   as temp_export_date,
  tmp.reference                       as temp_export_reference
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
left join public.piece_shipments imp on imp.piece_id = p.id and imp.kind = 'import'
left join public.shipments imps on imps.id = imp.shipment_id
left join public.piece_shipments exp on exp.piece_id = p.id and exp.kind = 'export'
left join public.shipments exps on exps.id = exp.shipment_id
left join lateral (
  select s.shipment_date, s.reference
  from public.piece_shipments ps join public.shipments s on s.id = ps.shipment_id
  where ps.piece_id = p.id and ps.kind = 'temporary_export'
    and ps.returned_at is null and ps.closed_reason is null
  order by s.shipment_date desc nulls last
  limit 1
) tmp on true
where f.vat_treatment = 'standard';

notify pgrst, 'reload schema';
