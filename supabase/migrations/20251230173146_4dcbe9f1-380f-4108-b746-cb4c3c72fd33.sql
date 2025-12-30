-- Add cloudinary_public_id column to publications table
ALTER TABLE publications ADD COLUMN IF NOT EXISTS cloudinary_public_id text;

-- Delete existing pages for this publication so it can be reprocessed with the new upload method
DELETE FROM publication_pages WHERE publication_id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';

-- Reset the publication status to pending for reprocessing
UPDATE publications 
SET processing_status = 'pending', 
    processing_error = null
WHERE id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';