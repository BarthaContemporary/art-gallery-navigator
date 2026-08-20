-- ---------------------------------------------------------------------------
-- Let live lists filter on Framed, and create the "Framed works" list.
--
-- Dynamic lists resolve against vw_pieces_list, which names its columns
-- explicitly and so never picked up 0067's framed flag. Appending the column
-- at the end keeps every existing column's name, type and position, which is
-- exactly what CREATE OR REPLACE VIEW permits.
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
  p.framed
from all_pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

-- The live list itself: membership is the framed flag, re-run on read, so it
-- maintains itself as works are ticked and unticked.
insert into public.piece_lists (name, description, is_dynamic, filter_rules)
select 'Framed works',
       'Live view — every work ticked as Framed.',
       true,
       '{"framed": true, "ledger": "all"}'::jsonb
where not exists (
  select 1 from public.piece_lists where name = 'Framed works' and is_dynamic
);

notify pgrst, 'reload schema';
