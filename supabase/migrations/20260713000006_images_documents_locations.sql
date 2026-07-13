-- 0006_images_documents_locations
-- Piece images (pipeline-managed), typed document attachments, location
-- movement history, and the private storage buckets.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.image_role as enum
    ('front', 'back', 'side', 'signature', 'box', 'detail', 'condition', 'document');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.doc_type as enum
    ('purchase_invoice', 'sale_invoice', 'certificate', 'export_licence',
     'condition_report', 'provenance_document', 'correspondence',
     'shipping', 'insurance', 'other');
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Piece images
-- Originals go to bucket `piece-originals` (TUS upload), the sharp worker
-- writes an sRGB JPEG display master to `piece-derivatives`; imgproxy renders
-- all other sizes on the fly from the display master.
-- ---------------------------------------------------------------------------
create table if not exists public.piece_images (
  id                        uuid primary key default gen_random_uuid(),
  piece_id                  uuid not null references public.pieces (id) on delete cascade,
  role                      public.image_role not null default 'detail',
  caption                   text,
  sort_order                int not null default 0,
  storage_path_original     text,           -- piece-originals/<piece>/<file>
  storage_path_display      text,           -- piece-derivatives/<piece>/<file>.jpg
  width                     int,
  height                    int,
  file_size_bytes           bigint,
  exif                      jsonb,
  processing_status         text not null default 'pending'
                            check (processing_status in ('pending', 'processing', 'done', 'error')),
  processing_error          text,
  legacy_container_filename text,           -- FileMaker container reference, for image matching
  created_by                uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now()
);

create index if not exists idx_piece_images_piece_id on public.piece_images (piece_id, sort_order);
create index if not exists idx_piece_images_pending  on public.piece_images (processing_status)
  where processing_status in ('pending', 'error');

-- ---------------------------------------------------------------------------
-- Piece documents: multiple typed attachments per piece.
-- RLS (0012): purchase/sale invoices visible to admin + accountant only.
-- ---------------------------------------------------------------------------
create table if not exists public.piece_documents (
  id           uuid primary key default gen_random_uuid(),
  piece_id     uuid not null references public.pieces (id) on delete cascade,
  doc_type     public.doc_type not null default 'other',
  title        text,
  storage_path text not null,               -- piece-documents/<piece>/<file>
  issued_by    text,
  issued_date  date,
  notes        text,
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_piece_documents_piece_id on public.piece_documents (piece_id);
create index if not exists idx_piece_documents_type     on public.piece_documents (doc_type);

-- Now that piece_documents exists, wire up the invoice references declared
-- (column-only) in 0005.
alter table public.piece_financials
  drop constraint if exists piece_financials_purchase_invoice_document_id_fkey,
  add constraint piece_financials_purchase_invoice_document_id_fkey
    foreign key (purchase_invoice_document_id)
    references public.piece_documents (id) on delete set null;

alter table public.piece_financials
  drop constraint if exists piece_financials_sale_invoice_document_id_fkey,
  add constraint piece_financials_sale_invoice_document_id_fkey
    foreign key (sale_invoice_document_id)
    references public.piece_documents (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Location history: appended automatically on every location change.
-- ---------------------------------------------------------------------------
create table if not exists public.piece_location_history (
  id               bigint generated always as identity primary key,
  piece_id         uuid not null references public.pieces (id) on delete cascade,
  from_location_id uuid references public.locations (id) on delete set null,
  to_location_id   uuid references public.locations (id) on delete set null,
  moved_at         timestamptz not null default now(),
  moved_by         uuid references auth.users (id) on delete set null,
  note             text
);

create index if not exists idx_piece_location_history_piece
  on public.piece_location_history (piece_id, moved_at desc);

create or replace function public.track_piece_location()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.piece_location_history
    (piece_id, from_location_id, to_location_id, moved_by)
  values
    (new.id, old.location_id, new.location_id,
     coalesce(auth.uid(), new.updated_by));
  return new;
end;
$$;

drop trigger if exists trg_pieces_location_history on public.pieces;
create trigger trg_pieces_location_history
  after update on public.pieces
  for each row
  when (old.location_id is distinct from new.location_id)
  execute function public.track_piece_location();

-- ---------------------------------------------------------------------------
-- Storage buckets (all private; signed URLs only).
-- Wrapped so a bare Postgres without the storage schema still migrates.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present, skipping bucket creation';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values
    ('piece-originals',   'piece-originals',   false),
    ('piece-derivatives', 'piece-derivatives', false),
    ('piece-documents',   'piece-documents',   false),
    ('kyc-documents',     'kyc-documents',     false)
  on conflict (id) do nothing;
end;
$$;
