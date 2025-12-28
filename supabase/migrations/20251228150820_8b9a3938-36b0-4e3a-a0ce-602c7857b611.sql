-- Fix artworks table RLS policies
-- Issue: All policies use {public} role which includes anonymous users

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can create their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can manage their own artworks" ON public.artworks;

-- Recreate with proper authentication requirements

-- 1. Admins can manage all artworks (authenticated only)
CREATE POLICY "Admins can manage all artworks"
ON public.artworks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- 2. Artists can manage their own artworks (authenticated only)
CREATE POLICY "Artists can manage own artworks"
ON public.artworks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = artworks.artist_id
    AND artists.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = artworks.artist_id
    AND artists.user_id = auth.uid()
  )
);

-- 3. Public can view artworks (read-only, no sensitive price data concern for display)
-- This allows gallery visitors to see artworks on public pages
CREATE POLICY "Public can view artworks"
ON public.artworks
FOR SELECT
TO anon
USING (true);