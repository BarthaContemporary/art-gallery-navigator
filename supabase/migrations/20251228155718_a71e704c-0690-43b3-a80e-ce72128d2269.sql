
-- Revoke public access to artworks table to protect pricing data
REVOKE SELECT ON public.artworks FROM PUBLIC;

-- Also ensure anon is explicitly blocked
REVOKE ALL ON public.artworks FROM anon;

-- Verify the safe view still has proper grants
GRANT SELECT ON public.artworks_public_safe TO anon;
GRANT SELECT ON public.artworks_public_safe TO authenticated;
