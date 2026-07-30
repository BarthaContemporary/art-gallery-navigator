-- 0064_sort_order_for_reordering
--
-- Add an explicit display order to the four surfaces the dealer reorders by
-- hand: inventory lists, contact lists, categories and locations.
--
-- Categories and locations are the ones that actually matter. They are picked
-- from dropdowns dozens of times a day during cataloguing, and alphabetical is
-- the wrong order for that — the six categories in constant use should sit at
-- the top, not wherever the alphabet puts them.
--
-- Seeded from each table's current display order, so nothing moves on the first
-- load after deploying. `origin_regions` already worked this way; this brings
-- the rest into line.
--
-- Ties are resolved by name/code in every reader, so rows sharing a sort_order
-- (new inserts default to 0) stay in a stable, predictable place rather than
-- shuffling between requests.

alter table public.piece_lists add column if not exists sort_order int not null default 0;
alter table public.crm_lists   add column if not exists sort_order int not null default 0;
alter table public.categories  add column if not exists sort_order int not null default 0;
alter table public.locations   add column if not exists sort_order int not null default 0;

comment on column public.categories.sort_order is
  'Hand-set order for the cataloguing dropdowns — the point is to put the '
  'frequently used categories first, not to sort them alphabetically.';

-- Seed: preserve what is on screen today.
with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.piece_lists
)
update public.piece_lists p set sort_order = r.rn from ranked r where r.id = p.id;

with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.crm_lists
)
update public.crm_lists c set sort_order = r.rn from ranked r where r.id = c.id;

with ranked as (
  select id, row_number() over (order by name) - 1 as rn from public.categories
)
update public.categories c set sort_order = r.rn from ranked r where r.id = c.id;

with ranked as (
  select id, row_number() over (order by code) - 1 as rn from public.locations
)
update public.locations l set sort_order = r.rn from ranked r where r.id = l.id;

create index if not exists idx_piece_lists_sort on public.piece_lists (sort_order);
create index if not exists idx_crm_lists_sort   on public.crm_lists (sort_order);
create index if not exists idx_categories_sort  on public.categories (sort_order);
create index if not exists idx_locations_sort   on public.locations (sort_order);

notify pgrst, 'reload schema';
