-- ---------------------------------------------------------------------------
-- Flip the frame-dimension semantics to match how the gallery measures.
--
-- The default dimensions of a framed work ARE the framed size — that is what
-- hangs on the wall, goes in the crate and appears in the catalogue. The
-- additional row records the unframed work itself. 0067's frame_* columns
-- therefore hold the wrong concept by name; rename them to unframed_* while
-- they are still empty (verified: zero rows carry frame data in either
-- register).
--
-- Both tables again change identically — the register views union them with
-- `select *`, so the column lists must stay aligned. RENAME keeps ordinal
-- positions, so the union stays sound.
--
-- vw_pieces_all is rebuilt because it captured `p.*` before 0067: the DOCX
-- exports and the public offer page read dimensions through it, and the new
-- columns must be visible there. Recreate (not replace): the appended table
-- columns land before the view's alias columns, which CREATE OR REPLACE
-- refuses as a column-order change.
-- ---------------------------------------------------------------------------

alter table public.pieces          rename column frame_height_cm   to unframed_height_cm;
alter table public.pieces          rename column frame_width_cm    to unframed_width_cm;
alter table public.pieces          rename column frame_depth_cm    to unframed_depth_cm;
alter table public.pieces          rename column frame_length_cm   to unframed_length_cm;
alter table public.pieces          rename column frame_diameter_cm to unframed_diameter_cm;
alter table public.pieces          rename column frame_weight_g    to unframed_weight_g;

alter table public.external_pieces rename column frame_height_cm   to unframed_height_cm;
alter table public.external_pieces rename column frame_width_cm    to unframed_width_cm;
alter table public.external_pieces rename column frame_depth_cm    to unframed_depth_cm;
alter table public.external_pieces rename column frame_length_cm   to unframed_length_cm;
alter table public.external_pieces rename column frame_diameter_cm to unframed_diameter_cm;
alter table public.external_pieces rename column frame_weight_g    to unframed_weight_g;

drop view if exists public.vw_pieces_all;
create view public.vw_pieces_all
with (security_invoker = true) as
select p.*,
       m.display_name as maker_name,
       m.life_dates   as maker_life_dates,
       c.name         as category_name,
       l.code         as location_code
  from (select * from public.pieces
        union all
        select * from public.external_pieces) p
  left join public.makers     m on m.id = p.maker_id
  left join public.categories c on c.id = p.category_id
  left join public.locations  l on l.id = p.location_id;

comment on view public.vw_pieces_all is
  'Full record for a work in either register. Read-only; writes go through the '
  'stock table that holds the row.';

grant select on public.vw_pieces_all to authenticated, service_role;

notify pgrst, 'reload schema';
