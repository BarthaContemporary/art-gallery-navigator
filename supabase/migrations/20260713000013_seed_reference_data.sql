-- 0013_seed_reference_data
-- Reference data needed in every environment (hence a migration, not
-- seed.sql which only runs locally): category tree, physical locations,
-- appointment types. No pieces — real stock arrives via the FileMaker
-- migration tooling.

-- ---------------------------------------------------------------------------
-- Categories (hierarchical: region > discipline)
-- ---------------------------------------------------------------------------
insert into public.categories (code, name) values
  ('JP',  'Japan'),
  ('IN',  'India'),
  ('SA',  'South Asia'),
  ('SEA', 'Southeast Asia'),
  ('CN',  'China'),
  ('HIM', 'Himalayan')
on conflict (code) do nothing;

insert into public.categories (code, name, parent_id) values
  ('JP-MET', 'Metalwork', (select id from public.categories where code = 'JP')),
  ('JP-SCU', 'Sculpture', (select id from public.categories where code = 'JP')),
  ('JP-CER', 'Ceramics',  (select id from public.categories where code = 'JP')),
  ('JP-LAC', 'Lacquer',   (select id from public.categories where code = 'JP')),
  ('JP-PRI', 'Prints',    (select id from public.categories where code = 'JP')),
  ('IN-SCU', 'Sculpture',  (select id from public.categories where code = 'IN')),
  ('IN-MIN', 'Miniatures', (select id from public.categories where code = 'IN')),
  ('IN-TEX', 'Textiles',   (select id from public.categories where code = 'IN'))
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
insert into public.locations (code, name, type) values
  ('ST-JAMES', 'St James''s gallery',       'gallery'),
  ('SJ-A3',    'St James''s — shelf A3',    'storage'),
  ('SJ-A4',    'St James''s — shelf A4',    'storage'),
  ('SJ-A5',    'St James''s — shelf A5',    'storage'),
  ('SJ-B2',    'St James''s — shelf B2',    'storage'),
  ('SJ-B3',    'St James''s — shelf B3',    'storage'),
  ('SJ-B4',    'St James''s — shelf B4',    'storage'),
  ('SJ-B5',    'St James''s — shelf B5',    'storage'),
  ('PP',       'Private premises',          'storage'),
  ('AUCTION',  'At auction',                'auction'),
  ('RESTORER', 'With restorer',             'restorer')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Appointment types (website /visit booking)
-- ---------------------------------------------------------------------------
insert into public.appointment_types (name, duration_minutes, location_id, active)
select v.name, v.duration_minutes,
       (select id from public.locations where code = v.location_code),
       true
from (values
  ('Private gallery viewing', 60, 'ST-JAMES'),
  ('Fair or exhibition meeting', 30, null)
) as v(name, duration_minutes, location_code)
where not exists (
  select 1 from public.appointment_types t where t.name = v.name
);
