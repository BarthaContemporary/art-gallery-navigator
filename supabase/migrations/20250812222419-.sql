-- Fix the security definer view issue
-- Recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.artists_public_safe;

-- Create a regular view (not security definer) for public artist information
CREATE VIEW public.artists_public_safe AS
SELECT 
    id,
    full_name,
    biography,
    nationality,
    birth_year,
    death_year,
    place_of_birth,
    place_of_death,
    image_url,
    representation_status,
    surname_first_letter,
    created_at,
    updated_at
FROM public.artists;

-- Grant access to the safe view
GRANT SELECT ON public.artists_public_safe TO anon, authenticated;