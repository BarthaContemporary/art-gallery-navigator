-- 0011_views
-- Reporting/list views. All views use security_invoker = true (Postgres 15)
-- so the querying user's own RLS applies to the underlying tables:
--   - staff selecting vw_pieces_list simply get NULL financial columns
--     (their RLS hides piece_financials rows from the LEFT JOIN);
--   - the stock-book views only return rows for admin/accountant, because
--     only those roles can see piece_financials at all.

-- ---------------------------------------------------------------------------
-- Studio inventory list
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
  -- primary image: prefer the 'front' shot, then sort order
  (select pi.id
     from public.piece_images pi
    where pi.piece_id = p.id
    order by (pi.role <> 'front'), pi.sort_order, pi.created_at
    limit 1)      as primary_image_id,
  f.marked_price_gbp,
  -- days in stock: purchase to sale (or to today while unsold)
  case
    when f.purchase_date is not null
    then coalesce(f.sold_date, now()::date) - f.purchase_date
  end             as days_in_stock,
  p.created_at,
  p.updated_at
from public.pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id;

comment on view public.vw_pieces_list is
  'Inventory list for the studio. security_invoker: financial columns are '
  'NULL for staff because their RLS hides piece_financials.';

-- ---------------------------------------------------------------------------
-- HMRC margin-scheme stock book (VAT Notice 718).
-- VAT due = 1/6 of the (positive) margin, i.e. 20% VAT fraction of a
-- VAT-inclusive margin. Losses carry no VAT and no offset (per-item scheme).
-- ---------------------------------------------------------------------------
create or replace view public.vw_stock_book
with (security_invoker = true) as
select
  p.id                                as piece_id,
  p.stock_number,
  f.purchase_date,
  f.purchase_invoice_document_id,
  trim(concat_ws(' ', sc.first_name, sc.last_name)) as seller_name,
  p.title
    || coalesce(' — ' || p.medium, '') as description,
  f.purchase_cost_gbp,
  f.sold_date,
  f.sale_invoice_document_id,
  f.sold_price_gbp,
  f.margin_gbp,
  round(greatest(coalesce(f.margin_gbp, 0), 0) / 6, 2) as vat_due_gbp,
  -- margin_pct computed here, never stored (avoids div-by-zero)
  case
    when coalesce(f.total_cost_gbp, 0) <> 0 and f.sold_price_gbp is not null
    then round(f.margin_gbp / f.total_cost_gbp * 100, 1)
  end                                 as margin_pct
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
where f.vat_treatment = 'margin_scheme';

comment on view public.vw_stock_book is
  'Margin-scheme stock book per HMRC VAT Notice 718: VAT due = 1/6 of the '
  'positive margin. Rows visible to admin + accountant only (security_invoker '
  'RLS on piece_financials). Accountant signs off format at Phase 1b gate.';

-- ---------------------------------------------------------------------------
-- Standard-rated items (sold outside the margin scheme).
-- Prices assumed VAT-inclusive: output VAT = 1/6 of gross sale price.
-- ---------------------------------------------------------------------------
create or replace view public.vw_stock_book_standard
with (security_invoker = true) as
select
  p.id                                as piece_id,
  p.stock_number,
  f.purchase_date,
  f.purchase_invoice_document_id,
  trim(concat_ws(' ', sc.first_name, sc.last_name)) as seller_name,
  p.title
    || coalesce(' — ' || p.medium, '') as description,
  f.purchase_cost_gbp,
  f.sold_date,
  f.sale_invoice_document_id,
  f.sold_price_gbp,
  round(coalesce(f.sold_price_gbp, 0) / 6, 2) as vat_due_gbp,
  f.margin_gbp
from public.pieces p
join public.piece_financials f on f.piece_id = p.id
left join public.crm_contacts sc on sc.id = f.seller_contact_id
where f.vat_treatment = 'standard';

-- ---------------------------------------------------------------------------
-- Days-in-stock helper (dashboard/aging reports)
-- ---------------------------------------------------------------------------
create or replace view public.vw_days_in_stock
with (security_invoker = true) as
select
  p.id            as piece_id,
  p.stock_number,
  p.title,
  p.status,
  f.purchase_date,
  f.sold_date,
  case
    when f.purchase_date is not null
    then coalesce(f.sold_date, now()::date) - f.purchase_date
  end             as days_in_stock
from public.pieces p
join public.piece_financials f on f.piece_id = p.id;

-- Views are SELECT-granted to authenticated; row visibility is enforced by
-- the underlying tables' RLS thanks to security_invoker.
grant select on public.vw_pieces_list,
                public.vw_stock_book,
                public.vw_stock_book_standard,
                public.vw_days_in_stock
to authenticated;
