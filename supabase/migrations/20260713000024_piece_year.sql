-- Add a free-text "year" for a piece (a single year like "2026" or a range
-- like "2024-26"). Distinct from `period` (era / reign, e.g. "Shōwa").
alter table public.pieces
  add column if not exists year text;

notify pgrst, 'reload schema';
