-- 0034_import_vat_consignment_stockbook
-- (1) Import VAT: pieces' financials record an import type + import VAT paid.
-- (2) Accountant gains read access to shipments / piece_shipments (import,
--     export, temporary export) — consignment fields are on pieces, already
--     readable by the accountant.
-- (3) Stock-book views carry consignment + import columns and apply the full
--     VAT logic (third-party consignment = no VAT; margin scheme absorbs
--     import VAT paid; standard shows reclaimable import VAT).

-- ---------------------------------------------------------------------------
-- Import VAT on piece_financials
-- ---------------------------------------------------------------------------
alter table public.piece_financials
  add column if not exists import_type    text,
  add column if not exists import_vat_gbp  numeric;

alter table public.piece_financials
  drop constraint if exists piece_financials_import_type_check;
alter table public.piece_financials
  add constraint piece_financials_import_type_check
    check (import_type is null
           or import_type in ('import_vat_paid', 'import_vat_deferred', 'temporary_import'));

-- ---------------------------------------------------------------------------
-- Accountant: read import / export / temporary-export shipment data
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['shipments', 'piece_shipments', 'shipment_documents']
  loop
    execute format('drop policy if exists accountant_select on public.%I', t);
    execute format($f$
      create policy accountant_select on public.%I
        for select to authenticated
        using (public.has_role(auth.uid(), 'accountant'))
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- vw_stock_book (margin scheme) — recompute VAT, add consignment + import cols.
-- CREATE OR REPLACE keeps the existing columns/order; new columns are appended.
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
  vd.vat_due_gbp,
  case
    when coalesce(f.total_cost_gbp, 0) <> 0 and f.sold_price_gbp is not null
    then round(f.margin_gbp / f.total_cost_gbp * 100, 1)
  end                                 as margin_pct,
  imps.shipment_date                  as import_date,
  imps.reference                      as import_reference,
  exps.shipment_date                  as export_date,
  exps.reference                      as export_reference,
  tmp.shipment_date                   as temp_export_date,
  tmp.reference                       as temp_export_reference,
  -- appended columns
  p.shares_note                       as consignment_co_owner,
  p.consignment_details               as consignment_notes,
  p.consignment_share_pct,
  p.sale_handled_by_jvb,
  sh.jvb_share_gbp,
  f.import_type,
  f.import_vat_gbp,
  null::numeric                       as reclaimable_import_vat_gbp
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
left join lateral (
  select case when f.import_type = 'import_vat_paid'
              then coalesce(f.import_vat_gbp, 0) else 0 end as import_vat_cost
) iv on true
left join lateral (
  select case
           when p.sale_handled_by_jvb is false then 0
           else round(greatest(coalesce(f.margin_gbp, 0) - iv.import_vat_cost, 0) / 6, 2)
         end as vat_due_gbp
) vd on true
left join lateral (
  select case
           when p.consignment_share_pct is null then null
           when p.sale_handled_by_jvb is false
             then round(p.consignment_share_pct / 100 * coalesce(f.sold_price_gbp, 0), 2)
           else round(p.consignment_share_pct / 100
                      * greatest(coalesce(f.sold_price_gbp, 0)
                                 - (coalesce(f.total_cost_gbp, 0) + iv.import_vat_cost)
                                 - vd.vat_due_gbp, 0), 2)
         end as jvb_share_gbp
) sh on true
where f.vat_treatment = 'margin_scheme';

-- ---------------------------------------------------------------------------
-- vw_stock_book_standard — standard-rated; third-party consignment = no VAT;
-- import VAT paid is reclaimable input VAT (recorded, not a cost).
-- ---------------------------------------------------------------------------
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
  vd.vat_due_gbp,
  f.margin_gbp,
  imps.shipment_date                  as import_date,
  imps.reference                      as import_reference,
  exps.shipment_date                  as export_date,
  exps.reference                      as export_reference,
  tmp.shipment_date                   as temp_export_date,
  tmp.reference                       as temp_export_reference,
  -- appended columns
  p.shares_note                       as consignment_co_owner,
  p.consignment_details               as consignment_notes,
  p.consignment_share_pct,
  p.sale_handled_by_jvb,
  sh.jvb_share_gbp,
  f.import_type,
  f.import_vat_gbp,
  case when f.import_type = 'import_vat_paid' then coalesce(f.import_vat_gbp, 0) else 0 end
                                      as reclaimable_import_vat_gbp
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
left join lateral (
  select case when p.sale_handled_by_jvb is false then 0
              else round(coalesce(f.sold_price_gbp, 0) / 6, 2) end as vat_due_gbp
) vd on true
left join lateral (
  select case
           when p.consignment_share_pct is null then null
           when p.sale_handled_by_jvb is false
             then round(p.consignment_share_pct / 100 * coalesce(f.sold_price_gbp, 0), 2)
           else round(p.consignment_share_pct / 100
                      * greatest(coalesce(f.sold_price_gbp, 0)
                                 - coalesce(f.total_cost_gbp, 0) - vd.vat_due_gbp, 0), 2)
         end as jvb_share_gbp
) sh on true
where f.vat_treatment = 'standard';

notify pgrst, 'reload schema';
