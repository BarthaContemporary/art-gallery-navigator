-- ---------------------------------------------------------------------------
-- Surface sold works with no £ purchase cost.
--
-- Migration 0066 cleared 21 mis-recorded purchase figures (yen/euro shown as
-- £); the sold ones can't show margin or VAT-due in the stock book until a
-- real £ figure is entered, and none have been filled in since. This appends
-- a `missing_purchase_gbp` flag to vw_pieces_list so the dashboard can triage
-- them and the inventory can filter to them (?nopurchase=1).
--
-- Scoped to purchase_gbp_cleared on purpose: ~120 legacy sales never had a
-- purchase £ recorded at all, and flagging those would drown the 13 works
-- someone actually needs to act on. The flag clears itself as figures are
-- entered.
--
-- Same shape as 0069: the column is appended at the end (all CREATE OR
-- REPLACE VIEW permits), and `with (security_invoker = true)` MUST be
-- restated — REPLACE resets the view's options, and without it the view
-- runs with owner rights and bypasses RLS (staff would see financials).
-- Under invoker RLS the flag is only ever true for roles that can read
-- purchase_gbp_cleared and piece_financials (admin/accountant), which is
-- also who can enter the figure.
-- ---------------------------------------------------------------------------

create or replace view public.vw_pieces_list
with (security_invoker = true) as
with all_pieces as (
  select * from public.pieces
  union all
  select * from public.external_pieces
)
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
  )               as on_temp_export,
  p.needs_completion,
  p.ledger,
  p.year,
  p.framed,
  (p.ledger = 'jvb' and p.status = 'sold' and f.purchase_cost_gbp is null
   and exists (select 1 from public.purchase_gbp_cleared g where g.piece_id = p.id))
                  as missing_purchase_gbp
from all_pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

notify pgrst, 'reload schema';
