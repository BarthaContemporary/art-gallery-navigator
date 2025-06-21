
-- Ensure the artwork-images-original bucket exists and has proper policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('artwork-images-original', 'artwork-images-original', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for original images bucket (authenticated users can access)
CREATE POLICY "Authenticated users can download original images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can upload original images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Service role can manage original images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'artwork-images-original' AND
    auth.role() = 'service_role'
  );

-- Ensure processed images bucket exists with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('artwork-images-processed', 'artwork-images-processed', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
