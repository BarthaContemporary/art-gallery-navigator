
-- Create storage buckets for the new image handling system
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('artwork-images-original', 'artwork-images-original', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('artwork-images-processed', 'artwork-images-processed', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- Create RLS policies for original images bucket (private, only accessible by authenticated users)
CREATE POLICY "Users can upload original images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view original images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update original images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete original images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

-- Create RLS policies for processed images bucket (public, accessible to everyone)
CREATE POLICY "Anyone can view processed images" ON storage.objects
  FOR SELECT USING (bucket_id = 'artwork-images-processed');

CREATE POLICY "Service can manage processed images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'artwork-images-processed' AND
    auth.role() = 'service_role'
  );

-- Update artwork_images table to include local storage URLs
ALTER TABLE artwork_images 
ADD COLUMN IF NOT EXISTS original_storage_path TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT,
ADD COLUMN IF NOT EXISTS medium_storage_path TEXT,
ADD COLUMN IF NOT EXISTS large_storage_path TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_artwork_images_processing_status ON artwork_images(processing_status);
CREATE INDEX IF NOT EXISTS idx_artwork_images_artwork_id_primary ON artwork_images(artwork_id, is_primary);
