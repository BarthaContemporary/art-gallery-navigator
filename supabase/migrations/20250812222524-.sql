-- Fix the search path security issue in the function
CREATE OR REPLACE FUNCTION public.get_artists_public()
RETURNS TABLE (
    id uuid,
    full_name text,
    biography text,
    nationality text,
    birth_year integer,
    death_year integer,
    place_of_birth text,
    place_of_death text,
    image_url text,
    representation_status text,
    surname_first_letter text,
    created_at timestamptz,
    updated_at timestamptz
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT 
        a.id,
        a.full_name,
        a.biography,
        a.nationality,
        a.birth_year,
        a.death_year,
        a.place_of_birth,
        a.place_of_death,
        a.image_url,
        a.representation_status,
        a.surname_first_letter,
        a.created_at,
        a.updated_at
    FROM public.artists a;
$$;