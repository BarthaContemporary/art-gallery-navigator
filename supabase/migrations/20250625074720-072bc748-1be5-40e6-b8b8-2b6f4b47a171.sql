
-- Drop existing RLS policies on artworks table if they exist
DROP POLICY IF EXISTS "Artists can view their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can view all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can create their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can update their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can delete their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can insert all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can update all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can delete all artworks" ON public.artworks;

-- Enable Row Level Security on the artworks table (safe to run multiple times)
ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;

-- Create policy for artists to view only their own artworks
CREATE POLICY "Artists can view their own artworks" 
ON public.artworks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.artists 
    WHERE artists.id = artworks.artist_id 
    AND artists.user_id = auth.uid()
  )
);

-- Create policy for admins to view all artworks
CREATE POLICY "Admins can view all artworks" 
ON public.artworks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'gallery_admin'
  )
);

-- Artists can insert artworks for themselves
CREATE POLICY "Artists can create their own artworks" 
ON public.artworks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.artists 
    WHERE artists.id = artworks.artist_id 
    AND artists.user_id = auth.uid()
  )
);

-- Artists can update their own artworks
CREATE POLICY "Artists can update their own artworks" 
ON public.artworks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.artists 
    WHERE artists.id = artworks.artist_id 
    AND artists.user_id = auth.uid()
  )
);

-- Artists can delete their own artworks
CREATE POLICY "Artists can delete their own artworks" 
ON public.artworks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.artists 
    WHERE artists.id = artworks.artist_id 
    AND artists.user_id = auth.uid()
  )
);

-- Admins can perform all operations on artworks
CREATE POLICY "Admins can insert all artworks" 
ON public.artworks 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'gallery_admin'
  )
);

CREATE POLICY "Admins can update all artworks" 
ON public.artworks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'gallery_admin'
  )
);

CREATE POLICY "Admins can delete all artworks" 
ON public.artworks 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'gallery_admin'
  )
);
