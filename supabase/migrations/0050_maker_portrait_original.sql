-- 0050: keep the maker portrait's original file alongside the processed
-- display version. portrait_path now always points at the processed
-- display JPEG (studio + web); portrait_original_path keeps the untouched
-- upload for high-resolution export documents.

alter table makers add column if not exists portrait_original_path text;

notify pgrst, 'reload schema';
