-- Add width and height columns to publication_pages if they don't exist
ALTER TABLE publication_pages ADD COLUMN IF NOT EXISTS width integer;
ALTER TABLE publication_pages ADD COLUMN IF NOT EXISTS height integer;

-- Create storage bucket for publication page images if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('publication-pages', 'publication-pages', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Public read access for publication pages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload publication pages" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update publication pages" ON storage.objects;

-- Create storage policy for public read access
CREATE POLICY "Public read access for publication pages"
ON storage.objects FOR SELECT
USING (bucket_id = 'publication-pages');

-- Create storage policy for service role upload (edge function uses service role)
CREATE POLICY "Authenticated users can upload publication pages"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'publication-pages');

-- Create storage policy for service role update
CREATE POLICY "Authenticated users can update publication pages"
ON storage.objects FOR UPDATE
USING (bucket_id = 'publication-pages');

-- Delete existing pages and reset publication for reprocessing
DELETE FROM publication_pages WHERE publication_id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';

UPDATE publications 
SET processing_status = 'pending', 
    processing_error = null
WHERE id = '76641a00-a4fb-418d-81b9-d978cb74b5f0';