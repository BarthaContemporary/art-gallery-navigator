-- ---------------------------------------------------------------------------
-- 0076 — temporary flags on inventory records.
--
-- A flag is a per-user scratch mark: "I want to come back to this one". The
-- inventory overview highlights flagged rows, a flag can be set from a row,
-- from the record page or on a whole selection, and the flagged set can be
-- filed into a list (existing or new) in one go, then cleared. Per user so two
-- people walking the stock never clobber each other's working set. No foreign
-- key to pieces: a work in either register can be flagged, and the overview
-- only ever shows flags that still resolve through vw_pieces_list.
-- ---------------------------------------------------------------------------

create table if not exists public.piece_flags (
  user_id    uuid not null references auth.users (id) on delete cascade,
  piece_id   uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);
create index if not exists idx_piece_flags_piece on public.piece_flags (piece_id);

alter table public.piece_flags enable row level security;

drop policy if exists flags_select_own on public.piece_flags;
create policy flags_select_own on public.piece_flags
  for select to authenticated using (user_id = auth.uid());
drop policy if exists flags_insert_own on public.piece_flags;
create policy flags_insert_own on public.piece_flags
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists flags_delete_own on public.piece_flags;
create policy flags_delete_own on public.piece_flags
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.piece_flags to authenticated;
revoke all on public.piece_flags from anon;

notify pgrst, 'reload schema';
