-- Publications & past exhibitions as editable lists on a piece.
-- Previously "Published / exhibited" was a single free-text note (published_note).
-- The edit panel now keeps two repeatable lists instead; store them as JSONB
-- arrays of strings so the autosave form can round-trip them in one field each.
alter table public.pieces
  add column if not exists publications jsonb not null default '[]'::jsonb,
  add column if not exists exhibitions  jsonb not null default '[]'::jsonb;

-- Seed the new publications list from the legacy free-text note so nothing is
-- lost. Kept as a single entry; staff can split it into separate lines later.
update public.pieces
   set publications = jsonb_build_array(btrim(published_note))
 where published_note is not null
   and btrim(published_note) <> ''
   and (publications is null or publications = '[]'::jsonb);

notify pgrst, 'reload schema';
