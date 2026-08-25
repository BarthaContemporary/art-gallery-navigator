-- ---------------------------------------------------------------------------
-- Exclusions for live lists.
--
-- A live list's membership is its saved filters re-run on read, so there was
-- no way to say "this work does not belong here" without changing the rules
-- for everything. piece_list_items — which a live list otherwise leaves
-- empty — now doubles as its exclusion list: a row with excluded = true pins
-- a work OUT of the list however the rules resolve. Static lists keep using
-- plain rows (excluded stays false) and removal keeps deleting the row.
-- ---------------------------------------------------------------------------

alter table public.piece_list_items
  add column if not exists excluded boolean not null default false;

create index if not exists idx_piece_list_items_excluded
  on public.piece_list_items (list_id)
  where excluded;

notify pgrst, 'reload schema';
