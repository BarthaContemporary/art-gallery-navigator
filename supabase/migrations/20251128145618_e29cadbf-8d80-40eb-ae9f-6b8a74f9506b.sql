-- Create a public-safe view for artwork_images that only exposes necessary columns
CREATE OR REPLACE VIEW public.artwork_images_public_safe AS
SELECT 
  id,
  artwork_id,
  image_url,
  thumbnail_url,
  medium_url,
  is_primary,
  display_order
FROM public.artwork_images;

-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Anyone can view artwork images" ON public.artwork_images;
DROP POLICY IF EXISTS "Public can read all artwork images" ON public.artwork_images;

-- Create a new policy that restricts raw table access to authenticated users only
CREATE POLICY "Authenticated users can view artwork images"
ON public.artwork_images
FOR SELECT
TO authenticated
USING (true);

-- Allow public access to the safe view (view has no RLS by default, inherits from base table)
GRANT SELECT ON public.artwork_images_public_safe TO anon, authenticated;