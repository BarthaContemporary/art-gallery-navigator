-- Re-derive display masters at 4096 px for the published works whose master
-- was capped at 2560 (run only AFTER the image worker with MAX_DIMENSION_PX =
-- 4096 is deployed on the VPS). Two steps:
--  1. forget the Sanity asset for each master, so the next sync re-uploads
--     the new pixels (ensureImageAsset caches by storage path);
--  2. queue the images; the worker overwrites the master in place and its
--     status write re-enqueues the piece for the website sync.
with capped as (
  select i.id, i.piece_id, i.storage_path_display
  from public.piece_images i
  join public.pieces p on p.id = i.piece_id
  where p.web_visible
    and i.processing_status = 'done'
    and i.storage_path_original is not null
    -- exactly at the old cap: a master already remade at up to 4096 px is
    -- never picked again, so running this twice is harmless
    and greatest(coalesce(i.width, 0), coalesce(i.height, 0)) = 2560
),
forgotten as (
  delete from public.sanity_assets s
  using capped c
  where s.storage_path = 'piece-derivatives/' || c.storage_path_display
  returning s.storage_path
)
update public.piece_images i
set processing_status = 'pending', processing_error = null
from capped c
where i.id = c.id
returning i.id, i.piece_id;
