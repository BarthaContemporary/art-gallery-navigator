-- 0037_stock_book_all
-- A combined stock-book view carrying EVERY item, whatever its VAT treatment
-- (margin / standard / zero-rated / outside-scope), with VAT computed per the
-- item's treatment. The per-scheme views remain for the formal HMRC reports.

create or replace view public.vw_stock_book_all
with (security_invoker = true) as
select
  p.id                                as piece_id,
  p.stock_number,
  f.vat_treatment,
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
  p.shares_note                       as consignment_co_owner,
  p.consignment_details               as consignment_notes,
  p.consignment_share_pct,
  p.sale_handled_by_jvb,
  sh.jvb_share_gbp,
  f.import_type,
  f.import_vat_gbp,
  case when f.import_type = 'import_vat_paid' and f.vat_treatment in ('standard', 'zero_rated', 'outside_scope')
       then coalesce(f.import_vat_gbp, 0) else 0 end as reclaimable_import_vat_gbp
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
  select case when f.import_type = 'import_vat_paid' and f.vat_treatment = 'margin_scheme'
              then coalesce(f.import_vat_gbp, 0) else 0 end as import_vat_cost
) iv on true
left join lateral (
  select case
           when p.sale_handled_by_jvb is false then 0
           when f.vat_treatment = 'margin_scheme'
             then round(greatest(coalesce(f.margin_gbp, 0) - iv.import_vat_cost, 0) / 6, 2)
           when f.vat_treatment = 'standard'
             then round(coalesce(f.sold_price_gbp, 0) / 6, 2)
           else 0
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
) sh on true;

grant select on public.vw_stock_book_all to authenticated;

notify pgrst, 'reload schema';
