
-- Fix the documents table constraint to allow WebDAV uploads to folders
-- The current constraint prevents documents from being linked only to folders
-- We need to modify it to allow documents that are only linked to folders (WebDAV uploads)

-- First, drop the existing constraint
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_single_entity_check;

-- Create a new constraint that allows documents to be linked to:
-- 1. Exactly one of: artwork_id, collection_id, or artist_id (original constraint)
-- 2. OR only to a folder_id (for WebDAV uploads)
ALTER TABLE public.documents ADD CONSTRAINT documents_single_entity_check 
CHECK (
  -- Allow documents linked only to folders (WebDAV case)
  (folder_id IS NOT NULL AND artwork_id IS NULL AND collection_id IS NULL AND artist_id IS NULL) OR
  -- Allow documents linked to exactly one other entity (original cases)
  (folder_id IS NULL AND (
    (artwork_id IS NOT NULL AND collection_id IS NULL AND artist_id IS NULL) OR
    (artwork_id IS NULL AND collection_id IS NOT NULL AND artist_id IS NULL) OR
    (artwork_id IS NULL AND collection_id IS NULL AND artist_id IS NOT NULL)
  )) OR
  -- Allow documents linked to both folder and one other entity
  (folder_id IS NOT NULL AND (
    (artwork_id IS NOT NULL AND collection_id IS NULL AND artist_id IS NULL) OR
    (artwork_id IS NULL AND collection_id IS NOT NULL AND artist_id IS NULL) OR
    (artwork_id IS NULL AND collection_id IS NULL AND artist_id IS NOT NULL)
  ))
);
