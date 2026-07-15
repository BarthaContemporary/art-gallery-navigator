-- ---------------------------------------------------------------------------
-- Link each area of interest to a real CRM mailing list, so "areas of interest"
-- become usable lists (newsletter/offers/labels). Memberships are kept in sync
-- by the app (contacts PATCH) whenever a contact's interests change; this seeds
-- the lists and backfills current members. Additive/idempotent.
-- ---------------------------------------------------------------------------

alter table public.crm_interest_areas
  add column if not exists list_id uuid references public.crm_lists (id) on delete set null;

-- Create one mailing list per area that doesn't have one yet.
do $$
declare a record; new_id uuid;
begin
  for a in select id, name from public.crm_interest_areas where list_id is null loop
    insert into public.crm_lists (name, description)
      values (a.name, 'Area of interest (auto)')
      returning id into new_id;
    update public.crm_interest_areas set list_id = new_id where id = a.id;
  end loop;
end $$;

-- Backfill members from contacts' current interests
-- (custom_fields.interests is a jsonb string[]).
insert into public.crm_list_members (list_id, contact_id)
select a.list_id, c.id
from public.crm_contacts c
join public.crm_interest_areas a
  on (c.custom_fields -> 'interests') ? a.name
where a.list_id is not null
on conflict do nothing;
