-- Remove overly permissive RLS policies from collection_artworks table
-- These policies expose artwork-collection relationships to anonymous/any authenticated users

DROP POLICY IF EXISTS "Anyone can view collection artworks" ON public.collection_artworks;
DROP POLICY IF EXISTS "Public can read all collection_artworks" ON public.collection_artworks;