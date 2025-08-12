-- Fix the security definer view issue by removing SECURITY DEFINER
DROP VIEW IF EXISTS public.artists_public;

-- Create a regular view without SECURITY DEFINER
CREATE VIEW public.artists_public AS
SELECT 
  id,
  full_name,
  nationality,
  birth_year,
  death_year,
  place_of_birth,
  place_of_death,
  biography,
  image_url,
  representation_status,
  surname_first_letter,
  created_at,
  updated_at
FROM public.artists;

-- Grant access to the view
GRANT SELECT ON public.artists_public TO anon;
GRANT SELECT ON public.artists_public TO authenticated;