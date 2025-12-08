-- Update artworks with missing slugs
UPDATE viewer_artworks 
SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || id
WHERE slug IS NULL;