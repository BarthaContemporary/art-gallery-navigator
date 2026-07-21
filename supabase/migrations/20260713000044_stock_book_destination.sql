-- 0044_stock_book_destination
-- Surface the export / temporary-export destination country in the stock book.
-- Appends export_destination + temp_export_destination to each view (and adds
-- destination_country to the temp-export lateral). Regenerated from live defs.


create or replace view public.vw_stock_book with (security_invoker = true) as
SELECT p.id AS piece_id,
    p.stock_number,
    f.purchase_date,
    f.purchase_invoice_document_id,
    TRIM(BOTH FROM concat_ws(' '::text, sc.first_name, sc.last_name)) AS seller_name,
    p.title || COALESCE(' — '::text || p.medium, ''::text) AS description,
    f.purchase_cost_gbp,
    f.sold_date,
    f.sale_invoice_document_id,
    f.sold_price_gbp,
    f.margin_gbp,
    vd.vat_due_gbp,
        CASE
            WHEN COALESCE(f.total_cost_gbp, 0::numeric) <> 0::numeric AND f.sold_price_gbp IS NOT NULL THEN round(f.margin_gbp / f.total_cost_gbp * 100::numeric, 1)
            ELSE NULL::numeric
        END AS margin_pct,
    imps.shipment_date AS import_date,
    imps.reference AS import_reference,
    exps.shipment_date AS export_date,
    exps.reference AS export_reference,
    tmp.shipment_date AS temp_export_date,
    tmp.reference AS temp_export_reference,
    p.shares_note AS consignment_co_owner,
    p.consignment_details AS consignment_notes,
    p.consignment_share_pct,
    p.sale_handled_by_jvb,
    sh.jvb_share_gbp,
    f.import_type,
    f.import_vat_gbp,
    NULL::numeric AS reclaimable_import_vat_gbp,
    exps.destination_country AS export_destination,
    tmp.destination_country AS temp_export_destination
   FROM pieces p
     JOIN piece_financials f ON f.piece_id = p.id
     LEFT JOIN crm_contacts sc ON sc.id = f.seller_contact_id
     LEFT JOIN piece_shipments imp ON imp.piece_id = p.id AND imp.kind = 'import'::shipment_kind
     LEFT JOIN shipments imps ON imps.id = imp.shipment_id
     LEFT JOIN piece_shipments exp ON exp.piece_id = p.id AND exp.kind = 'export'::shipment_kind
     LEFT JOIN shipments exps ON exps.id = exp.shipment_id
     LEFT JOIN LATERAL ( SELECT s.shipment_date,
            s.reference, s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN f.import_type = 'import_vat_paid'::text THEN COALESCE(f.import_vat_gbp, 0::numeric)
                    ELSE 0::numeric
                END AS import_vat_cost) iv ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.sale_handled_by_jvb IS FALSE THEN 0::numeric
                    ELSE round(GREATEST(COALESCE(f.margin_gbp, 0::numeric) - iv.import_vat_cost, 0::numeric) / 6::numeric, 2)
                END AS vat_due_gbp) vd ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.consignment_share_pct IS NULL THEN NULL::numeric
                    ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp, 0::numeric) - (GREATEST(COALESCE(f.total_cost_gbp, 0::numeric) - COALESCE(f.purchase_cost_gbp, 0::numeric), 0::numeric) + iv.import_vat_cost), 2)
                END AS jvb_share_gbp) sh ON true
  WHERE f.vat_treatment = 'margin_scheme'::vat_treatment;;

create or replace view public.vw_stock_book_standard with (security_invoker = true) as
SELECT p.id AS piece_id,
    p.stock_number,
    f.purchase_date,
    f.purchase_invoice_document_id,
    TRIM(BOTH FROM concat_ws(' '::text, sc.first_name, sc.last_name)) AS seller_name,
    p.title || COALESCE(' — '::text || p.medium, ''::text) AS description,
    f.purchase_cost_gbp,
    f.sold_date,
    f.sale_invoice_document_id,
    f.sold_price_gbp,
    vd.vat_due_gbp,
    f.margin_gbp,
    imps.shipment_date AS import_date,
    imps.reference AS import_reference,
    exps.shipment_date AS export_date,
    exps.reference AS export_reference,
    tmp.shipment_date AS temp_export_date,
    tmp.reference AS temp_export_reference,
    p.shares_note AS consignment_co_owner,
    p.consignment_details AS consignment_notes,
    p.consignment_share_pct,
    p.sale_handled_by_jvb,
    sh.jvb_share_gbp,
    f.import_type,
    f.import_vat_gbp,
        CASE
            WHEN f.import_type = 'import_vat_paid'::text THEN COALESCE(f.import_vat_gbp, 0::numeric)
            ELSE 0::numeric
        END AS reclaimable_import_vat_gbp,
    exps.destination_country AS export_destination,
    tmp.destination_country AS temp_export_destination
   FROM pieces p
     JOIN piece_financials f ON f.piece_id = p.id
     LEFT JOIN crm_contacts sc ON sc.id = f.seller_contact_id
     LEFT JOIN piece_shipments imp ON imp.piece_id = p.id AND imp.kind = 'import'::shipment_kind
     LEFT JOIN shipments imps ON imps.id = imp.shipment_id
     LEFT JOIN piece_shipments exp ON exp.piece_id = p.id AND exp.kind = 'export'::shipment_kind
     LEFT JOIN shipments exps ON exps.id = exp.shipment_id
     LEFT JOIN LATERAL ( SELECT s.shipment_date,
            s.reference, s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.sale_handled_by_jvb IS FALSE THEN 0::numeric
                    ELSE round(COALESCE(f.sold_price_gbp, 0::numeric) / 6::numeric, 2)
                END AS vat_due_gbp) vd ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.consignment_share_pct IS NULL THEN NULL::numeric
                    ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp, 0::numeric) - GREATEST(COALESCE(f.total_cost_gbp, 0::numeric) - COALESCE(f.purchase_cost_gbp, 0::numeric), 0::numeric), 2)
                END AS jvb_share_gbp) sh ON true
  WHERE f.vat_treatment = 'standard'::vat_treatment;;

create or replace view public.vw_stock_book_zero_rated with (security_invoker = true) as
SELECT p.id AS piece_id,
    p.stock_number,
    f.purchase_date,
    f.purchase_invoice_document_id,
    TRIM(BOTH FROM concat_ws(' '::text, sc.first_name, sc.last_name)) AS seller_name,
    p.title || COALESCE(' — '::text || p.medium, ''::text) AS description,
    f.purchase_cost_gbp,
    f.sold_date,
    f.sale_invoice_document_id,
    f.sold_price_gbp,
    0::numeric AS vat_due_gbp,
    f.margin_gbp,
    imps.shipment_date AS import_date,
    imps.reference AS import_reference,
    exps.shipment_date AS export_date,
    exps.reference AS export_reference,
    tmp.shipment_date AS temp_export_date,
    tmp.reference AS temp_export_reference,
    p.shares_note AS consignment_co_owner,
    p.consignment_details AS consignment_notes,
    p.consignment_share_pct,
    p.sale_handled_by_jvb,
    sh.jvb_share_gbp,
    f.import_type,
    f.import_vat_gbp,
        CASE
            WHEN f.import_type = 'import_vat_paid'::text THEN COALESCE(f.import_vat_gbp, 0::numeric)
            ELSE 0::numeric
        END AS reclaimable_import_vat_gbp,
    exps.destination_country AS export_destination,
    tmp.destination_country AS temp_export_destination
   FROM pieces p
     JOIN piece_financials f ON f.piece_id = p.id
     LEFT JOIN crm_contacts sc ON sc.id = f.seller_contact_id
     LEFT JOIN piece_shipments imp ON imp.piece_id = p.id AND imp.kind = 'import'::shipment_kind
     LEFT JOIN shipments imps ON imps.id = imp.shipment_id
     LEFT JOIN piece_shipments exp ON exp.piece_id = p.id AND exp.kind = 'export'::shipment_kind
     LEFT JOIN shipments exps ON exps.id = exp.shipment_id
     LEFT JOIN LATERAL ( SELECT s.shipment_date,
            s.reference, s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.consignment_share_pct IS NULL THEN NULL::numeric
                    ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - 0::numeric, 0::numeric) - GREATEST(COALESCE(f.total_cost_gbp, 0::numeric) - COALESCE(f.purchase_cost_gbp, 0::numeric), 0::numeric), 2)
                END AS jvb_share_gbp) sh ON true
  WHERE f.vat_treatment = 'zero_rated'::vat_treatment;;

create or replace view public.vw_stock_book_outside_scope with (security_invoker = true) as
SELECT p.id AS piece_id,
    p.stock_number,
    f.purchase_date,
    f.purchase_invoice_document_id,
    TRIM(BOTH FROM concat_ws(' '::text, sc.first_name, sc.last_name)) AS seller_name,
    p.title || COALESCE(' — '::text || p.medium, ''::text) AS description,
    f.purchase_cost_gbp,
    f.sold_date,
    f.sale_invoice_document_id,
    f.sold_price_gbp,
    0::numeric AS vat_due_gbp,
    f.margin_gbp,
    imps.shipment_date AS import_date,
    imps.reference AS import_reference,
    exps.shipment_date AS export_date,
    exps.reference AS export_reference,
    tmp.shipment_date AS temp_export_date,
    tmp.reference AS temp_export_reference,
    p.shares_note AS consignment_co_owner,
    p.consignment_details AS consignment_notes,
    p.consignment_share_pct,
    p.sale_handled_by_jvb,
    sh.jvb_share_gbp,
    f.import_type,
    f.import_vat_gbp,
        CASE
            WHEN f.import_type = 'import_vat_paid'::text THEN COALESCE(f.import_vat_gbp, 0::numeric)
            ELSE 0::numeric
        END AS reclaimable_import_vat_gbp,
    exps.destination_country AS export_destination,
    tmp.destination_country AS temp_export_destination
   FROM pieces p
     JOIN piece_financials f ON f.piece_id = p.id
     LEFT JOIN crm_contacts sc ON sc.id = f.seller_contact_id
     LEFT JOIN piece_shipments imp ON imp.piece_id = p.id AND imp.kind = 'import'::shipment_kind
     LEFT JOIN shipments imps ON imps.id = imp.shipment_id
     LEFT JOIN piece_shipments exp ON exp.piece_id = p.id AND exp.kind = 'export'::shipment_kind
     LEFT JOIN shipments exps ON exps.id = exp.shipment_id
     LEFT JOIN LATERAL ( SELECT s.shipment_date,
            s.reference, s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.consignment_share_pct IS NULL THEN NULL::numeric
                    ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - 0::numeric, 0::numeric) - GREATEST(COALESCE(f.total_cost_gbp, 0::numeric) - COALESCE(f.purchase_cost_gbp, 0::numeric), 0::numeric), 2)
                END AS jvb_share_gbp) sh ON true
  WHERE f.vat_treatment = 'outside_scope'::vat_treatment;;

create or replace view public.vw_stock_book_all with (security_invoker = true) as
SELECT p.id AS piece_id,
    p.stock_number,
    f.vat_treatment,
    f.purchase_date,
    f.purchase_invoice_document_id,
    TRIM(BOTH FROM concat_ws(' '::text, sc.first_name, sc.last_name)) AS seller_name,
    p.title || COALESCE(' — '::text || p.medium, ''::text) AS description,
    f.purchase_cost_gbp,
    f.sold_date,
    f.sale_invoice_document_id,
    f.sold_price_gbp,
    vd.vat_due_gbp,
    f.margin_gbp,
    imps.shipment_date AS import_date,
    imps.reference AS import_reference,
    exps.shipment_date AS export_date,
    exps.reference AS export_reference,
    tmp.shipment_date AS temp_export_date,
    tmp.reference AS temp_export_reference,
    p.shares_note AS consignment_co_owner,
    p.consignment_details AS consignment_notes,
    p.consignment_share_pct,
    p.sale_handled_by_jvb,
    sh.jvb_share_gbp,
    f.import_type,
    f.import_vat_gbp,
        CASE
            WHEN f.import_type = 'import_vat_paid'::text AND (f.vat_treatment = ANY (ARRAY['standard'::vat_treatment, 'zero_rated'::vat_treatment, 'outside_scope'::vat_treatment])) THEN COALESCE(f.import_vat_gbp, 0::numeric)
            ELSE 0::numeric
        END AS reclaimable_import_vat_gbp,
    f.total_cost_gbp,
    exps.destination_country AS export_destination,
    tmp.destination_country AS temp_export_destination
   FROM pieces p
     JOIN piece_financials f ON f.piece_id = p.id
     LEFT JOIN crm_contacts sc ON sc.id = f.seller_contact_id
     LEFT JOIN piece_shipments imp ON imp.piece_id = p.id AND imp.kind = 'import'::shipment_kind
     LEFT JOIN shipments imps ON imps.id = imp.shipment_id
     LEFT JOIN piece_shipments exp ON exp.piece_id = p.id AND exp.kind = 'export'::shipment_kind
     LEFT JOIN shipments exps ON exps.id = exp.shipment_id
     LEFT JOIN LATERAL ( SELECT s.shipment_date,
            s.reference, s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN f.import_type = 'import_vat_paid'::text AND f.vat_treatment = 'margin_scheme'::vat_treatment THEN COALESCE(f.import_vat_gbp, 0::numeric)
                    ELSE 0::numeric
                END AS import_vat_cost) iv ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.sale_handled_by_jvb IS FALSE THEN 0::numeric
                    WHEN f.vat_treatment = 'margin_scheme'::vat_treatment THEN round(GREATEST(COALESCE(f.margin_gbp, 0::numeric) - iv.import_vat_cost, 0::numeric) / 6::numeric, 2)
                    WHEN f.vat_treatment = 'standard'::vat_treatment THEN round(COALESCE(f.sold_price_gbp, 0::numeric) / 6::numeric, 2)
                    ELSE 0::numeric
                END AS vat_due_gbp) vd ON true
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN p.consignment_share_pct IS NULL THEN NULL::numeric
                    ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp, 0::numeric) - (GREATEST(COALESCE(f.total_cost_gbp, 0::numeric) - COALESCE(f.purchase_cost_gbp, 0::numeric), 0::numeric) + iv.import_vat_cost), 2)
                END AS jvb_share_gbp) sh ON true;;


grant select on public.vw_stock_book_all to authenticated;

notify pgrst, 'reload schema';
