
-- Fix: Restrict artwork-images-original storage to admin and artist roles only
DROP POLICY IF EXISTS "Users can upload original images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view original images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update original images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete original images" ON storage.objects;

-- Admins and artists can view original images
CREATE POLICY "Admins and artists can view original images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'artwork-images-original' AND
  (
    auth.role() = 'service_role' OR
    has_role(auth.uid(), 'gallery_admin'::user_role) OR
    has_role(auth.uid(), 'artist'::user_role)
  )
);

-- Admins and artists can upload original images
CREATE POLICY "Admins and artists can upload original images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'artwork-images-original' AND
  (
    auth.role() = 'service_role' OR
    has_role(auth.uid(), 'gallery_admin'::user_role) OR
    has_role(auth.uid(), 'artist'::user_role)
  )
);

-- Admins and artists can update original images
CREATE POLICY "Admins and artists can update original images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'artwork-images-original' AND
  (
    auth.role() = 'service_role' OR
    has_role(auth.uid(), 'gallery_admin'::user_role) OR
    has_role(auth.uid(), 'artist'::user_role)
  )
)
WITH CHECK (
  bucket_id = 'artwork-images-original' AND
  (
    auth.role() = 'service_role' OR
    has_role(auth.uid(), 'gallery_admin'::user_role) OR
    has_role(auth.uid(), 'artist'::user_role)
  )
);

-- Admins can delete original images (artists cannot delete to prevent accidental data loss)
CREATE POLICY "Admins can delete original images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'artwork-images-original' AND
  (
    auth.role() = 'service_role' OR
    has_role(auth.uid(), 'gallery_admin'::user_role)
  )
);
