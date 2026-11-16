-- ---------------------------------------------------------------------------
-- 0098: records and money review follow-ups. Additive; the studio works
-- without it (until it is applied the stock book screen hides the unsold
-- share itself, and the trash refuses a sold work's purge for staff by its
-- status).
--
-- 1. jvb_share_gbp is NULL until there is a sale £. The five stock-book views
--    read a missing sale as 0, so an unsold consigned work showed its costs
--    as J.v.d.B.'s share, in the exports too. The definitions are 0045's,
--    changed only in that CASE: every column keeps its name and place, and
--    `with (security_invoker = true)` is restated on each, since CREATE OR
--    REPLACE VIEW resets the options and without it the views would run with
--    the owner's rights (staff would read piece_financials through them).
--
-- 2. A work with a sale on record is not purged with its purchase and sale
--    record (RETENTION_SCHEDULE.md: kept six years, never purged by the
--    system). Deleting the stock row cascades to piece_financials, so:
--    - a signed-in user other than an administrator cannot delete such a row
--      from public.pieces (staff cannot even read the figures they would
--      remove). An administrator still can, say a true duplicate. A register
--      move (admin only, inside move_piece_ledger) copies the row into the
--      other table first and is let through either way.
--    - the nightly purge_deleted_pieces() leaves such rows in the trash for a
--      person to decide, filtering them out in its WHERE so one sold work
--      cannot abort the whole purge.
-- ---------------------------------------------------------------------------

-- 1. The stock-book views.
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
            s.reference,
            s.destination_country
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
                CASE WHEN p.consignment_share_pct IS NULL OR f.sold_price_gbp IS NULL THEN NULL::numeric ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp - (greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric) + iv.import_vat_cost), 0::numeric) + (greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric) + iv.import_vat_cost), 2) END AS jvb_share_gbp) sh ON true
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
            s.reference,
            s.destination_country
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
                CASE WHEN p.consignment_share_pct IS NULL OR f.sold_price_gbp IS NULL THEN NULL::numeric ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp - greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 0::numeric) + greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 2) END AS jvb_share_gbp) sh ON true
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
            s.reference,
            s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE WHEN p.consignment_share_pct IS NULL OR f.sold_price_gbp IS NULL THEN NULL::numeric ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - 0::numeric - greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 0::numeric) + greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 2) END AS jvb_share_gbp) sh ON true
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
            s.reference,
            s.destination_country
           FROM piece_shipments ps
             JOIN shipments s ON s.id = ps.shipment_id
          WHERE ps.piece_id = p.id AND ps.kind = 'temporary_export'::shipment_kind AND ps.returned_at IS NULL AND ps.closed_reason IS NULL
          ORDER BY s.shipment_date DESC NULLS LAST
         LIMIT 1) tmp ON true
     LEFT JOIN LATERAL ( SELECT
                CASE WHEN p.consignment_share_pct IS NULL OR f.sold_price_gbp IS NULL THEN NULL::numeric ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - 0::numeric - greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 0::numeric) + greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric), 2) END AS jvb_share_gbp) sh ON true
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
            s.reference,
            s.destination_country
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
                CASE WHEN p.consignment_share_pct IS NULL OR f.sold_price_gbp IS NULL THEN NULL::numeric ELSE round(p.consignment_share_pct / 100::numeric * GREATEST(COALESCE(f.sold_price_gbp, 0::numeric) - vd.vat_due_gbp - (greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric) + iv.import_vat_cost), 0::numeric) + (greatest(coalesce(f.total_cost_gbp,0::numeric) - coalesce(f.purchase_cost_gbp,0::numeric), 0::numeric) + iv.import_vat_cost), 2) END AS jvb_share_gbp) sh ON true;


-- ---------------------------------------------------------------------------
-- 2. Sold works are kept.
-- ---------------------------------------------------------------------------
create or replace function public.guard_sold_piece_delete()
returns trigger
language plpgsql
security definer   -- reads piece_financials, which staff cannot
set search_path = public
as $$
begin
  -- Not a signed-in user (the nightly purge, the service role, a migration):
  -- the caller's own WHERE decides.
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return old;
  end if;
  if public.has_role(auth.uid(), 'admin') then
    return old;
  end if;
  -- A register move has already copied the row into the other stock table.
  if exists (select 1 from public.external_pieces e where e.id = old.id) then
    return old;
  end if;
  if exists (
    select 1 from public.piece_financials f
     where f.piece_id = old.id
       and (f.sold_date is not null or f.sold_price is not null or f.sold_price_gbp is not null)
  ) then
    raise exception 'This work has a sale on record, so it is kept with the books. Ask an administrator to remove it.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke execute on function public.guard_sold_piece_delete() from public, anon, authenticated;

drop trigger if exists trg_pieces_guard_sold_delete on public.pieces;
create trigger trg_pieces_guard_sold_delete
  before delete on public.pieces
  for each row execute function public.guard_sold_piece_delete();

-- 0056's purge, with sold works in public.pieces left in the trash. Same
-- signature, so the grants 0093 set (service role only) stay as they are.
create or replace function public.purge_deleted_pieces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n     integer;
  _total integer := 0;
begin
  with del as (
    delete from public.pieces p
     where p.deleted_at is not null
       and p.deleted_at < now() - interval '30 days'
       and not exists (
         select 1 from public.piece_financials f
          where f.piece_id = p.id
            and (f.sold_date is not null or f.sold_price is not null or f.sold_price_gbp is not null))
    returning 1)
  select count(*) into _n from del;
  _total := _total + _n;

  with del as (
    delete from public.external_pieces x
     where x.deleted_at is not null
       and x.deleted_at < now() - interval '30 days'
    returning 1)
  select count(*) into _n from del;
  _total := _total + _n;

  return _total;
end;
$$;

notify pgrst, 'reload schema';
