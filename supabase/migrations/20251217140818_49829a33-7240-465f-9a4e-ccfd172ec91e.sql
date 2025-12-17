-- Fix RLS infinite recursion for collections
-- Step 1: Drop and recreate is_collection_accessible_by_current_artist as SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.is_collection_accessible_by_current_artist(_collection_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.collection_artworks ca
    JOIN public.artworks aw ON ca.artwork_id = aw.id
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE ca.collection_id = _collection_id 
    AND art.user_id = auth.uid()
  );
END;
$$;

-- Step 2: Ensure collection_artworks has proper RLS policies
-- First drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage collection_artworks" ON public.collection_artworks;
DROP POLICY IF EXISTS "Artists can view their artwork links" ON public.collection_artworks;

-- Create admin policy for full access
CREATE POLICY "Admins can manage collection_artworks"
ON public.collection_artworks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create a SECURITY DEFINER function for artist artwork link access check
CREATE OR REPLACE FUNCTION public.is_artist_artwork_in_collection(_artwork_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.artworks aw
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE aw.id = _artwork_id
    AND art.user_id = auth.uid()
  );
$$;

-- Create artist SELECT policy using the SECURITY DEFINER function
CREATE POLICY "Artists can view their artwork links"
ON public.collection_artworks
FOR SELECT
TO authenticated
USING (public.is_artist_artwork_in_collection(artwork_id));