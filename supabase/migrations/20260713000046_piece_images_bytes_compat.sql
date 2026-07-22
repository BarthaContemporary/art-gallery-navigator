-- 0046_piece_images_bytes_compat
-- Compatibility shim. The currently-deployed image-worker writes the derivative
-- file size to a column named `bytes`, but the table uses `file_size_bytes`, so
-- every derivative job failed with:
--   column "bytes" of relation "piece_images" does not exist
-- Add `bytes` so the deployed worker succeeds immediately (no container
-- redeploy needed). The worker source has been corrected to write
-- file_size_bytes; once the corrected worker is redeployed this column can be
-- dropped.

alter table public.piece_images add column if not exists bytes bigint;

notify pgrst, 'reload schema';
