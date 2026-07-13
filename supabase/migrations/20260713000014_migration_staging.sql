-- Migration staging: permanent, auditable snapshot of the legacy FileMaker
-- export plus the dealer-reviewed value mappings. Populated by
-- tooling/migration (load-raw / import-mappings / finalize).

create table if not exists public.legacy_filemaker_rows (
  id uuid primary key default gen_random_uuid(),
  row_number integer not null,
  raw jsonb not null,
  piece_id uuid references public.pieces (id) on delete set null,
  issues text[] not null default '{}',
  import_batch text not null default 'initial',
  created_at timestamptz not null default now(),
  unique (import_batch, row_number)
);

create index if not exists legacy_filemaker_rows_piece_idx
  on public.legacy_filemaker_rows (piece_id);

create table if not exists public.legacy_value_mappings (
  id uuid primary key default gen_random_uuid(),
  field text not null,
  raw_value text not null,
  mapped_kind text,
  mapped_value text,
  reviewed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (field, raw_value)
);

alter table public.legacy_filemaker_rows enable row level security;
alter table public.legacy_value_mappings enable row level security;

-- Admin-only: the raw rows contain purchase costs and buyer names.
create policy legacy_rows_admin_all on public.legacy_filemaker_rows
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy legacy_mappings_admin_all on public.legacy_value_mappings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
