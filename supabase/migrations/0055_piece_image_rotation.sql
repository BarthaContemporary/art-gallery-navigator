-- Record the cumulative manual rotation applied to an image's display master.
--
-- Rotation is performed on the derivative (the JPEG the studio, website and
-- exports all read), leaving the archival original untouched. Storing the angle
-- means a future re-derivation from the original can re-apply it instead of
-- silently reverting a correction someone made by hand.
--
-- Degrees clockwise, normalised to 0/90/180/270.

alter table public.piece_images
  add column if not exists rotation smallint not null default 0;

alter table public.piece_images
  drop constraint if exists piece_images_rotation_check;

alter table public.piece_images
  add constraint piece_images_rotation_check
  check (rotation in (0, 90, 180, 270));

comment on column public.piece_images.rotation is
  'Cumulative manual rotation (degrees clockwise) applied to storage_path_display. The original is never rotated; re-derivation should re-apply this.';

notify pgrst, 'reload schema';
