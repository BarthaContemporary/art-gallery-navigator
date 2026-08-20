-- ---------------------------------------------------------------------------
-- Frame dimensions: a work can be framed, and the frame has its own
-- measurements (relevant for works on paper especially — shipping, storage
-- and wall space are governed by the frame, not the sheet).
--
-- Both stock tables get the same columns in the same order: the register
-- views union them with `select *`, so their column lists must stay aligned
-- position-for-position.
-- ---------------------------------------------------------------------------

alter table public.pieces
  add column if not exists framed            boolean not null default false,
  add column if not exists frame_height_cm   numeric,
  add column if not exists frame_width_cm    numeric,
  add column if not exists frame_depth_cm    numeric,
  add column if not exists frame_length_cm   numeric,
  add column if not exists frame_diameter_cm numeric,
  add column if not exists frame_weight_g    numeric;

alter table public.external_pieces
  add column if not exists framed            boolean not null default false,
  add column if not exists frame_height_cm   numeric,
  add column if not exists frame_width_cm    numeric,
  add column if not exists frame_depth_cm    numeric,
  add column if not exists frame_length_cm   numeric,
  add column if not exists frame_diameter_cm numeric,
  add column if not exists frame_weight_g    numeric;

notify pgrst, 'reload schema';
