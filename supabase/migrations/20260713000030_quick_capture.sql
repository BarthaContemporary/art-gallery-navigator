-- 0030_quick_capture
-- Staging tables for the mobile "Quick Capture" app (apps/capture): fast
-- preliminary entry of newly-purchased works, invoices and contacts from an
-- iPhone. Captures live in their own tables and are reviewed, then pushed to
-- the real inventory (which creates `pieces` flagged `needs_completion`).
--
-- Contacts are NOT staged — the capture app writes straight to crm_contacts.

-- ---------------------------------------------------------------------------
-- Where a purchase happened (drives the geolocation → source resolution)
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.capture_source_type as enum
    ('gallery', 'dealer', 'auction', 'fair', 'private', 'other');
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- pieces: flag records that arrived via quick capture and still need a human
-- to finish cataloguing them. Surfaced + filterable in the studio inventory.
-- ---------------------------------------------------------------------------
alter table public.pieces
  add column if not exists needs_completion boolean not null default false;

create index if not exists idx_pieces_needs_completion
  on public.pieces (needs_completion) where needs_completion;

-- ---------------------------------------------------------------------------
-- Capture batch = one purchase session (one or more works + optional invoice).
-- Purchase date + geolocation are captured automatically at creation.
-- ---------------------------------------------------------------------------
create table if not exists public.capture_batches (
  id             uuid primary key default gen_random_uuid(),
  created_by     uuid references auth.users (id) on delete set null,
  captured_at    timestamptz not null default now(),   -- purchase date
  geo_lat        numeric,
  geo_lng        numeric,
  geo_accuracy   numeric,
  source_type    public.capture_source_type,
  source_name    text,      -- resolved gallery/dealer/auction name (Google Places), editable
  source_address text,
  notes          text,
  status         text not null default 'draft'
                 check (status in ('draft', 'pushed', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_capture_batches_status
  on public.capture_batches (status, captured_at desc);

-- ---------------------------------------------------------------------------
-- Captured work: a preliminary record inside a batch.
-- `extracted` holds the raw Claude reading of a work label (if one was found).
-- ---------------------------------------------------------------------------
create table if not exists public.capture_works (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.capture_batches (id) on delete cascade,
  maker           text,
  title           text,
  year            text,
  medium          text,
  dimensions_text text,
  period          text,
  origin_region   text,
  category        text,
  notes           text,
  label_detected  boolean not null default false,
  extracted       jsonb,
  sort_order      int not null default 0,
  status          text not null default 'draft'
                  check (status in ('draft', 'pushed', 'skipped')),
  pushed_piece_id uuid references public.pieces (id) on delete set null,
  pushed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_capture_works_batch
  on public.capture_works (batch_id, sort_order);

-- ---------------------------------------------------------------------------
-- Photos for a captured work. `is_label` marks the photo Claude read as a
-- work label. Files live in the private `captures` bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.capture_photos (
  id           uuid primary key default gen_random_uuid(),
  work_id      uuid references public.capture_works (id) on delete cascade,
  batch_id     uuid references public.capture_batches (id) on delete cascade,
  storage_path text not null,        -- captures/<batch>/<work>/<file>
  is_label     boolean not null default false,
  width        int,
  height       int,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_capture_photos_work
  on public.capture_photos (work_id, sort_order);

-- ---------------------------------------------------------------------------
-- Invoices — multi-page, squared-up by Claude, linkable to captured works
-- and/or existing inventory pieces.
-- ---------------------------------------------------------------------------
create table if not exists public.capture_invoices (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid references auth.users (id) on delete set null,
  batch_id     uuid references public.capture_batches (id) on delete set null,
  captured_at  timestamptz not null default now(),
  vendor       text,
  reference    text,
  invoice_date date,
  total        numeric,
  currency     text,
  notes        text,
  extracted    jsonb,
  status       text not null default 'draft'
               check (status in ('draft', 'pushed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_capture_invoices_batch
  on public.capture_invoices (batch_id, captured_at desc);

create table if not exists public.capture_invoice_pages (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.capture_invoices (id) on delete cascade,
  storage_path text not null,        -- captures/invoices/<invoice>/<page> (original)
  squared_path text,                 -- captures/invoices/<invoice>/<page>-squared.jpg
  page_no      int not null default 1,
  created_at   timestamptz not null default now()
);

create index if not exists idx_capture_invoice_pages
  on public.capture_invoice_pages (invoice_id, page_no);

create table if not exists public.capture_invoice_links (
  invoice_id uuid not null references public.capture_invoices (id) on delete cascade,
  work_id    uuid references public.capture_works (id) on delete cascade,
  piece_id   uuid references public.pieces (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_capture_invoice_link_work
  on public.capture_invoice_links (invoice_id, work_id) where work_id is not null;
create unique index if not exists uq_capture_invoice_link_piece
  on public.capture_invoice_links (invoice_id, piece_id) where piece_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['capture_batches', 'capture_works', 'capture_invoices']
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I '
      'for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: admin + staff full access on every capture table (internal tool).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'capture_batches', 'capture_works', 'capture_photos',
    'capture_invoices', 'capture_invoice_pages', 'capture_invoice_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists capture_staff_admin_all on public.%I', t);
    execute format($f$
      create policy capture_staff_admin_all on public.%I
        for all to authenticated
        using (public.has_any_role(auth.uid(), 'admin', 'staff'))
        with check (public.has_any_role(auth.uid(), 'admin', 'staff'))
    $f$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private `captures` bucket + admin/staff read-write policy.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('captures', 'captures', false)
    on conflict (id) do nothing;
  end if;

  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists captures_staff_admin_rw on storage.objects';
    execute $f$
      create policy captures_staff_admin_rw on storage.objects
        for all to authenticated
        using (
          bucket_id = 'captures'
          and public.has_any_role(auth.uid(), 'admin', 'staff')
        )
        with check (
          bucket_id = 'captures'
          and public.has_any_role(auth.uid(), 'admin', 'staff')
        )
    $f$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expose needs_completion on the inventory list view (appended at the end;
-- CREATE OR REPLACE VIEW may only add columns after the existing ones).
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
  p.needs_completion
from public.pieces p
left join public.makers           m on m.id = p.maker_id
left join public.categories       c on c.id = p.category_id
left join public.locations        l on l.id = p.location_id
left join public.piece_financials f on f.piece_id = p.id
where p.deleted_at is null;

notify pgrst, 'reload schema';
