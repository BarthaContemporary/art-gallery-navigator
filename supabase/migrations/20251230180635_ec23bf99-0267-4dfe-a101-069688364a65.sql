-- Delete existing pages for the publication so it can be reprocessed
DELETE FROM publication_pages WHERE publication_id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';

-- Reset the publication status to pending for reprocessing
UPDATE publications 
SET processing_status = 'pending', 
    processing_error = null,
    cloudinary_public_id = null
WHERE id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';