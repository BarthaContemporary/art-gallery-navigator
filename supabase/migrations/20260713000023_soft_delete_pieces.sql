-- ---------------------------------------------------------------------------
-- Soft-delete for inventory pieces: deleting sets deleted_at (a 30-day
-- recycle bin); a scheduled purge hard-deletes anything older than 30 days.
-- ---------------------------------------------------------------------------

alter table public.pieces
  add column if not exists deleted_at timestamptz;

create index if not exists idx_pieces_deleted_at
  on public.pieces (deleted_at)
  where deleted_at is not null;

-- Inventory list view excludes soft-deleted pieces.
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
  p.updated_at
from public.pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

-- Keep soft-deleted pieces out of search results too.
create or replace function public.pieces_search(q text)
returns setof public.pieces
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.pieces p
  left join public.makers m on m.id = p.maker_id
  where
    p.deleted_at is null
    and (
      p.search_vector @@ websearch_to_tsquery('english', q)
      or p.search_vector @@ websearch_to_tsquery('simple', q)
      or p.stock_number ilike q || '%'
      or p.legacy_stock_number ilike q || '%'
      or p.title ilike '%' || q || '%'
      or p.description ilike '%' || q || '%'
      or similarity(coalesce(p.title, ''), q) > 0.2
      or m.display_name ilike '%' || q || '%'
      or m.native_name ilike '%' || q || '%'
      or m.romanized_name ilike '%' || q || '%'
      or similarity(coalesce(m.display_name, ''), q) > 0.3
      or similarity(coalesce(m.romanized_name, ''), q) > 0.3
      or exists (
        select 1 from unnest(m.alt_names) an
        where an ilike '%' || q || '%' or similarity(an, q) > 0.3
      )
    )
  order by
    (p.stock_number = q or p.legacy_stock_number = q) desc,
    ts_rank(p.search_vector,
            websearch_to_tsquery('english', q)
            || websearch_to_tsquery('simple', q)) desc,
    greatest(
      similarity(coalesce(p.title, ''), q),
      similarity(coalesce(m.display_name, ''), q),
      similarity(coalesce(m.romanized_name, ''), q)
    ) desc,
    p.stock_number;
$$;

-- Hard-delete pieces that have been in the recycle bin for over 30 days.
create or replace function public.purge_deleted_pieces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with gone as (
    delete from public.pieces
    where deleted_at is not null
      and deleted_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into n from gone;
  return n;
end;
$$;
