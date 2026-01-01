-- Reset the test publication to retry processing
UPDATE publications 
SET 
  processing_status = 'pending',
  processing_error = NULL,
  cloudinary_public_id = NULL,
  page_count = NULL
WHERE id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';

-- Delete existing pages for this publication
DELETE FROM publication_pages WHERE publication_id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';