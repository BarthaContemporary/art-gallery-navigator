-- 0088: a third way to draw a work's square tile: the photograph as taken.
--
-- Many older works were photographed in a room, on a table against a wall,
-- not on the studio backdrop. Continuing a wall and a table edge beyond the
-- photograph cannot be done cleanly, so such a photograph is shown as taken,
-- cut square from its middle. 'photo' joins 'flat' and 'object' as the
-- owner's choice on the piece and as what the sync may read on 'auto'.

alter table public.pieces drop constraint if exists pieces_presentation_check;
alter table public.pieces add constraint pieces_presentation_check
  check (presentation in ('auto', 'flat', 'object', 'photo'));

alter table public.external_pieces drop constraint if exists external_pieces_presentation_check;
alter table public.external_pieces add constraint external_pieces_presentation_check
  check (presentation in ('auto', 'flat', 'object', 'photo'));

alter table public.piece_image_squares drop constraint if exists piece_image_squares_guess_check;
alter table public.piece_image_squares add constraint piece_image_squares_guess_check
  check (guess in ('flat', 'object', 'photo'));

alter table public.piece_image_squares drop constraint if exists piece_image_squares_kind_check;
alter table public.piece_image_squares add constraint piece_image_squares_kind_check
  check (kind in ('flat', 'object', 'photo'));

comment on column public.pieces.presentation is
  'Website square: auto (decided from the photograph), flat (fit on white), object (centred on the extended backdrop) or photo (the photograph as taken, cut square from the middle).';

notify pgrst, 'reload schema';
