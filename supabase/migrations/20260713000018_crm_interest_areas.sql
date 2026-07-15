-- ---------------------------------------------------------------------------
-- crm_interest_areas — the editable master list of "areas of interest" that
-- staff assign to contacts (per-contact selections live in
-- crm_contacts.custom_fields.interests as a string[]). Staff can add new areas
-- from within the contact editor. Additive/idempotent.
-- ---------------------------------------------------------------------------

create table if not exists public.crm_interest_areas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

alter table public.crm_interest_areas enable row level security;
drop policy if exists staff_all on public.crm_interest_areas;
create policy staff_all on public.crm_interest_areas
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'staff'));
revoke all on public.crm_interest_areas from anon;

-- Starter list (placeholders — staff can rename/remove and add their own).
insert into public.crm_interest_areas (name, sort_order) values
  ('Indian sculpture', 10),
  ('Indian miniatures', 20),
  ('Indian textiles', 30),
  ('Himalayan art', 40),
  ('Japanese metalwork', 50),
  ('Japanese ceramics', 60),
  ('Japanese lacquer', 70),
  ('Japanese prints', 80),
  ('Chinese works of art', 90),
  ('Southeast Asian art', 100)
on conflict (name) do nothing;
