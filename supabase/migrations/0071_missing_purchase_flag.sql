-- 0071: surface sold works with no £ purchase cost.
--
-- Migration 0066 cleared 21 mis-recorded purchase figures (yen/euro shown as
-- £); the sold ones can't show margin or VAT-due in the stock book until a
-- real £ figure is entered, and none have been filled in since. This adds a
-- `missing_purchase_gbp` flag to vw_pieces_list so the dashboard can triage
-- them and the inventory can filter to them (?nopurchase=1).
--
-- CREATE OR REPLACE VIEW is safe here because the new column is appended at
-- the end of the select list (Postgres allows adding trailing columns only).
--
-- Scoped to purchase_gbp_cleared on purpose: ~120 legacy sales never had a
-- purchase £ recorded at all, and flagging those would drown the 13 works
-- someone actually needs to act on. The flag clears itself as figures are
-- entered.

create or replace view public.vw_pieces_list as
with all_pieces as (
  select pieces.id, pieces.stock_number, pieces.legacy_stock_number,
         pieces.legacy_stock_number_conflict, pieces.title, pieces.maker_id,
         pieces.attribution_qualifier, pieces.category_id, pieces.medium,
         pieces.period, pieces.origin_region, pieces.description,
         pieces.condition_report, pieces.signature_inscription,
         pieces.box_type, pieces.box_notes, pieces.height_cm, pieces.width_cm,
         pieces.depth_cm, pieces.length_cm, pieces.diameter_cm,
         pieces.weight_g, pieces.dimensions_display, pieces.status,
         pieces.location_id, pieces.photographer, pieces.comments, pieces.tags,
         pieces.ai_suggestions, pieces.web_visible, pieces.created_by,
         pieces.updated_by, pieces.created_at, pieces.updated_at,
         pieces.search_vector, pieces.source_note, pieces.published_note,
         pieces.shares_note, pieces.consignment_details, pieces.purchased_from,
         pieces.sold_to, pieces.document_note, pieces.legacy_modified_at,
         pieces.legacy_modified_by, pieces.deleted_at, pieces.year,
         pieces.publications, pieces.exhibitions, pieces.needs_completion,
         pieces.consignment_share_pct, pieces.sale_handled_by_jvb,
         pieces.consignee_contact_id, pieces.ledger, pieces.framed,
         pieces.unframed_height_cm, pieces.unframed_width_cm,
         pieces.unframed_depth_cm, pieces.unframed_length_cm,
         pieces.unframed_diameter_cm, pieces.unframed_weight_g
    from pieces
  union all
  select external_pieces.id, external_pieces.stock_number,
         external_pieces.legacy_stock_number,
         external_pieces.legacy_stock_number_conflict, external_pieces.title,
         external_pieces.maker_id, external_pieces.attribution_qualifier,
         external_pieces.category_id, external_pieces.medium,
         external_pieces.period, external_pieces.origin_region,
         external_pieces.description, external_pieces.condition_report,
         external_pieces.signature_inscription, external_pieces.box_type,
         external_pieces.box_notes, external_pieces.height_cm,
         external_pieces.width_cm, external_pieces.depth_cm,
         external_pieces.length_cm, external_pieces.diameter_cm,
         external_pieces.weight_g, external_pieces.dimensions_display,
         external_pieces.status, external_pieces.location_id,
         external_pieces.photographer, external_pieces.comments,
         external_pieces.tags, external_pieces.ai_suggestions,
         external_pieces.web_visible, external_pieces.created_by,
         external_pieces.updated_by, external_pieces.created_at,
         external_pieces.updated_at, external_pieces.search_vector,
         external_pieces.source_note, external_pieces.published_note,
         external_pieces.shares_note, external_pieces.consignment_details,
         external_pieces.purchased_from, external_pieces.sold_to,
         external_pieces.document_note, external_pieces.legacy_modified_at,
         external_pieces.legacy_modified_by, external_pieces.deleted_at,
         external_pieces.year, external_pieces.publications,
         external_pieces.exhibitions, external_pieces.needs_completion,
         external_pieces.consignment_share_pct,
         external_pieces.sale_handled_by_jvb,
         external_pieces.consignee_contact_id, external_pieces.ledger,
         external_pieces.framed, external_pieces.unframed_height_cm,
         external_pieces.unframed_width_cm, external_pieces.unframed_depth_cm,
         external_pieces.unframed_length_cm,
         external_pieces.unframed_diameter_cm, external_pieces.unframed_weight_g
    from external_pieces
)
select p.id,
       p.stock_number,
       p.legacy_stock_number,
       p.legacy_stock_number_conflict,
       p.title,
       p.maker_id,
       m.display_name as maker_name,
       p.category_id,
       c.name as category_name,
       p.medium,
       p.period,
       p.origin_region,
       p.status,
       p.location_id,
       l.code as location_code,
       p.web_visible,
       p.tags,
       ( select pi.id
           from piece_images pi
          where pi.piece_id = p.id
          order by (pi.role <> 'front'::image_role), pi.sort_order, pi.created_at
          limit 1) as primary_image_id,
       f.marked_price_gbp,
       case
         when f.purchase_date is not null
           then coalesce(f.sold_date, now()::date) - f.purchase_date
         else null::integer
       end as days_in_stock,
       p.created_at,
       p.updated_at,
       (exists ( select 1
                   from piece_shipments ps
                  where ps.piece_id = p.id
                    and ps.kind = 'temporary_export'::shipment_kind
                    and ps.returned_at is null
                    and ps.closed_reason is null)) as on_temp_export,
       p.needs_completion,
       p.ledger,
       p.year,
       p.framed,
       (p.ledger = 'jvb' and p.status = 'sold' and f.purchase_cost_gbp is null
        and exists (select 1 from purchase_gbp_cleared g where g.piece_id = p.id))
         as missing_purchase_gbp
  from all_pieces p
  left join makers m on m.id = p.maker_id
  left join categories c on c.id = p.category_id
  left join locations l on l.id = p.location_id
  left join piece_financials f on f.piece_id = p.id
 where p.deleted_at is null;

notify pgrst, 'reload schema';
