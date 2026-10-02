-- ---------------------------------------------------------------------------
-- 0077 — pieces_search: a partial stock number finds the work.
--
-- Stock numbers only matched as a prefix ("2026-03…"), so typing "0338" — the
-- part anyone actually remembers — found nothing. Match anywhere in the stock
-- and legacy numbers; exact matches still sort first, then stock-number hits,
-- then the ranked text matches. Same signature, return type and both-register
-- union as the live definition (0056_external_register.sql).
-- ---------------------------------------------------------------------------

create or replace function public.pieces_search(q text)
returns setof public.pieces
language sql
stable
set search_path = public
as $$
  with all_pieces as (
    select * from public.pieces
    union all
    select * from public.external_pieces
  )
  select p.*
  from all_pieces p
  left join public.makers m on m.id = p.maker_id
  where
    p.deleted_at is null
    and (
      p.search_vector @@ websearch_to_tsquery('english', q)
      or p.search_vector @@ websearch_to_tsquery('simple', q)
      or p.stock_number ilike '%' || q || '%'
      or p.legacy_stock_number ilike '%' || q || '%'
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
    (p.stock_number ilike '%' || q || '%' or p.legacy_stock_number ilike '%' || q || '%') desc,
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

notify pgrst, 'reload schema';
