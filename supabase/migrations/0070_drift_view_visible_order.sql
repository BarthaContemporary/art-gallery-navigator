-- ---------------------------------------------------------------------------
-- Compare the two stock tables by VISIBLE column order, not raw attnum.
--
-- external_pieces carries a dropped-column tombstone at attnum 54, and
-- Postgres never reuses those slots — so after 0067 added the frame columns
-- to both tables, every column from `framed` onward sits one raw ordinal
-- later in external_pieces than in pieces. vw_ledger_schema_drift compared
-- raw ordinals, reported seven phantom drifts, and move_piece_ledger's guard
-- refused every register move ("2026-1105 won't move") — silently, because
-- the record page didn't render the error it was sent (fixed app-side).
--
-- `select *` — which is what the union views actually rely on — expands by
-- visible order and skips tombstones, and by that measure the tables agree
-- exactly. The view now ranks visible columns with row_number(), so a ghost
-- slot can never fake a drift again, while genuine drift (missing column,
-- type change, real order divergence) still trips the guard.
-- ---------------------------------------------------------------------------

drop view if exists public.vw_ledger_schema_drift;
create view public.vw_ledger_schema_drift as
with p as (
  select column_name::text, data_type::text,
         row_number() over (order by ordinal_position)::int as pos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'pieces'
), e as (
  select column_name::text, data_type::text,
         row_number() over (order by ordinal_position)::int as pos
    from information_schema.columns
   where table_schema = 'public' and table_name = 'external_pieces'
)
select coalesce(p.column_name, e.column_name) as column_name,
       p.data_type as pieces_type,
       e.data_type as external_pieces_type,
       p.pos      as pieces_position,
       e.pos      as external_pieces_position
  from p
  full join e using (column_name)
 where p.column_name is null
    or e.column_name is null
    or p.data_type is distinct from e.data_type
    or p.pos is distinct from e.pos;

comment on view public.vw_ledger_schema_drift is
  'Non-empty = pieces and external_pieces disagree in visible column order, '
  'names or types, and register moves are refused until fixed.';

grant select on public.vw_ledger_schema_drift to authenticated, service_role;

notify pgrst, 'reload schema';
