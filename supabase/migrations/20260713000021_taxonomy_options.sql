-- ---------------------------------------------------------------------------
-- Curated, editable dropdowns for Category and Origin/region.
-- Non-destructive: legacy import categories are hidden (is_active=false), not
-- deleted, so existing pieces keep their assignment.
-- ---------------------------------------------------------------------------

-- 1. categories.is_active ---------------------------------------------------
alter table public.categories
  add column if not exists is_active boolean not null default true;

-- Start from a clean slate: hide everything, then activate the curated set.
update public.categories set is_active = false;

-- Consolidate the two duplicate "Sculpture" rows onto one canonical row so the
-- picker shows a single "Sculpture".
do $$
declare
  keep_id uuid;
  dup_id  uuid;
begin
  select id into keep_id from public.categories where code = 'JP-SCU' limit 1;
  select id into dup_id  from public.categories where code = 'IN-SCU' limit 1;
  if keep_id is not null and dup_id is not null then
    update public.pieces set category_id = keep_id where category_id = dup_id;
  end if;
end $$;

-- Reuse the existing Ceramics / Sculpture rows as canonical entries.
update public.categories set name = 'Ceramic', is_active = true where code = 'JP-CER';
update public.categories set is_active = true where code = 'JP-SCU';

-- Add the remaining curated categories (idempotent by unique code).
insert into public.categories (code, name, is_active) values
  ('PAINT',  'Painting',       true),
  ('WOP',    'Works on paper', true),
  ('BRONZE', 'Bronze',         true),
  ('BAMBOO', 'Bamboo/Wood',    true)
on conflict (code) do update set name = excluded.name, is_active = true;

-- 2. origin_regions ---------------------------------------------------------
-- Editable option list backing the free-text pieces.origin_region field.
create table if not exists public.origin_regions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.origin_regions enable row level security;

drop policy if exists admin_all on public.origin_regions;
create policy admin_all on public.origin_regions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists staff_all on public.origin_regions;
create policy staff_all on public.origin_regions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));

revoke all on public.origin_regions from anon;

insert into public.origin_regions (name, sort_order) values
  ('Japanese', 10),
  ('Indian',   20),
  ('Other',    30)
on conflict (name) do nothing;
