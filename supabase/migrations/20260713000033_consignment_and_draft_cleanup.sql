-- 0033_consignment_and_draft_cleanup
-- (1) Consignment panel gains a share/commission percentage and a
--     "sale handled by JvB" flag. The old Document Note field is retired
--     (column kept for data safety; just no longer edited).
-- (2) A cleanup for blank draft pieces left behind by "New record" (which now
--     creates a draft up front) — purges records that were never given any
--     content, after a grace period.

-- ---------------------------------------------------------------------------
-- Consignment columns on pieces (siblings of shares_note / consignment_details)
-- ---------------------------------------------------------------------------
alter table public.pieces
  add column if not exists consignment_share_pct numeric,
  add column if not exists sale_handled_by_jvb    boolean;

alter table public.pieces
  drop constraint if exists pieces_consignment_share_pct_check;
alter table public.pieces
  add constraint pieces_consignment_share_pct_check
    check (consignment_share_pct is null
           or (consignment_share_pct > 0 and consignment_share_pct < 100));

-- ---------------------------------------------------------------------------
-- Purge blank draft pieces.
-- A draft (from "New record") is "blank" when nothing has been entered: no
-- descriptive fields, no images/documents/shipments, and no financial data.
-- The grace period protects a record that is actively being created.
-- ---------------------------------------------------------------------------
create or replace function public.purge_blank_draft_pieces(grace interval default '2 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with del as (
    delete from public.pieces p
    where p.deleted_at is null
      and p.created_at < now() - grace
      -- descriptive / cataloguing fields all empty
      and p.title is null
      and p.maker_id is null
      and p.category_id is null
      and p.location_id is null
      and p.year is null
      and p.medium is null
      and p.period is null
      and p.origin_region is null
      and p.description is null
      and p.condition_report is null
      and p.signature_inscription is null
      and p.box_type is null and p.box_notes is null
      and p.dimensions_display is null
      and p.height_cm is null and p.width_cm is null and p.depth_cm is null
      and p.length_cm is null and p.diameter_cm is null and p.weight_g is null
      and coalesce(p.comments, '') = ''
      and coalesce(p.source_note, '') = ''
      and coalesce(p.purchased_from, '') = ''
      and coalesce(p.sold_to, '') = ''
      and coalesce(p.shares_note, '') = ''
      and coalesce(p.consignment_details, '') = ''
      and p.consignment_share_pct is null
      and p.sale_handled_by_jvb is null
      and (p.publications is null or p.publications = '[]'::jsonb)
      and (p.exhibitions is null or p.exhibitions = '[]'::jsonb)
      and coalesce(array_length(p.tags, 1), 0) = 0
      and p.web_visible = false
      -- no related records
      and not exists (select 1 from public.piece_images pi where pi.piece_id = p.id)
      and not exists (select 1 from public.document_pieces dp where dp.piece_id = p.id)
      and not exists (select 1 from public.piece_shipments ps where ps.piece_id = p.id)
      -- no financial data entered
      and not exists (
        select 1 from public.piece_financials f
        where f.piece_id = p.id
          and (f.purchase_cost is not null
               or f.purchase_date is not null
               or f.marked_price_gbp is not null
               or f.sold_price is not null
               or f.sold_date is not null
               or f.seller_contact_id is not null
               or f.buyer_contact_id is not null
               or f.consignment_id is not null)
      )
    returning 1
  )
  select count(*) into n from del;
  return n;
end;
$$;

notify pgrst, 'reload schema';
