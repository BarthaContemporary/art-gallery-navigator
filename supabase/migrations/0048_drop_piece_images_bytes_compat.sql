-- 0048: drop the temporary piece_images.bytes compat column.
--
-- 0046 added `bytes` so the then-deployed image-worker (which wrote to a
-- misnamed column) could finish the FileMaker backlog before a rebuild.
-- The worker has since been rebuilt from fixed source (writes
-- file_size_bytes) and redeployed on the VPS, so the compat column can go.

alter table piece_images drop column if exists bytes;

notify pgrst, 'reload schema';
