-- 0085: how a work is presented in the website's square tiles.
--
-- pieces.presentation is the owner's choice: 'auto' lets the sync decide from
-- the photograph (a flat work cropped to its edges fits on white; an object on
-- a studio backdrop is centred with the backdrop extended), 'flat' and
-- 'object' force it. piece_image_squares records what the sync decided for a
-- display master and where the rendered square derivative lives, so the
-- studio can show the guess and the sync can skip work already done. It is a
-- separate table rather than columns on piece_images so writing it does not
-- fire trg_piece_images_sync_outbox and start another sync round.

alter table public.pieces
  add column if not exists presentation text not null default 'auto'
    check (presentation in ('auto', 'flat', 'object'));

comment on column public.pieces.presentation is
  'Website square: auto (decided from the photograph), flat (fit on white) or object (centred on the extended backdrop).';

alter table public.external_pieces
  add column if not exists presentation text not null default 'auto'
    check (presentation in ('auto', 'flat', 'object'));

create table if not exists public.piece_image_squares (
  image_id      uuid primary key references public.piece_images (id) on delete cascade,
  guess         text not null check (guess in ('flat', 'object')),
  kind          text not null check (kind in ('flat', 'object')),
  square_path   text,
  source_width  integer,
  source_height integer,
  box           jsonb,
  rendered_at   timestamptz not null default now()
);

comment on table public.piece_image_squares is
  'Per display master: the sync''s flat/object guess, the kind it last rendered, and the square derivative path (piece-derivatives bucket) for objects.';

alter table public.piece_image_squares enable row level security;

-- Staff see the guess on the piece page; only the sync (service role) writes.
drop policy if exists staff_read on public.piece_image_squares;
create policy staff_read on public.piece_image_squares
  for select to authenticated using (true);

revoke all on public.piece_image_squares from anon;

notify pgrst, 'reload schema';
