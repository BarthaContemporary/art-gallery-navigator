-- ---------------------------------------------------------------------------
-- Fuzzier search: add substring matching on titles/descriptions to the piece
-- omnisearch, and add a trigram-fuzzy contact search function.
-- ---------------------------------------------------------------------------

-- pieces_search: keep FTS + trigram + maker matching, and additionally match
-- substrings inside titles/descriptions (so "kimono" finds "okimono", etc.).
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

-- crm_contacts_search(q): substring + trigram-fuzzy over names/email, ranked.
-- SECURITY INVOKER so RLS on crm_contacts still applies to the caller.
create or replace function public.crm_contacts_search(q text)
returns setof public.crm_contacts
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
  from public.crm_contacts c
  where
    q is null or length(btrim(q)) = 0
    or c.first_name ilike '%' || q || '%'
    or c.last_name ilike '%' || q || '%'
    or c.email ilike '%' || q || '%'
    or (coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) ilike '%' || q || '%'
    or similarity(coalesce(c.first_name, ''), q) > 0.3
    or similarity(coalesce(c.last_name, ''), q) > 0.3
    or similarity(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''), q) > 0.3
  order by
    greatest(
      similarity(coalesce(c.first_name, ''), q),
      similarity(coalesce(c.last_name, ''), q),
      similarity(coalesce(c.email, ''), q),
      similarity(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''), q)
    ) desc,
    c.last_name
  limit 100;
$$;
