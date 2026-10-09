-- 0087: remember the catalogue hint a square guess was made with.
--
-- The flat/object reading of a photograph takes the piece's medium and title
-- into account (a pale, even border on a print is its mount, not a
-- backdrop). The guess is cached per master, so filling in the medium after
-- first publication changed nothing. The hint is now stored with the guess
-- and a different hint makes the guess stale; the rendered square itself does
-- not depend on it and stays cached.

alter table public.piece_image_squares
  add column if not exists flat_hint boolean;

comment on column public.piece_image_squares.flat_hint is
  'Whether the medium/title read as a flat work when the guess was made; a change re-reads the photograph.';

notify pgrst, 'reload schema';
