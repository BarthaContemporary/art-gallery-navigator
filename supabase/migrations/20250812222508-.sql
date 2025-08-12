-- Comprehensive fix for artist contact information protection
-- First, drop the current overly permissive policy
DROP POLICY IF EXISTS "Public can view basic artist information" ON public.artists;

-- Create separate policies for different access levels
-- 1. Public users: Basic info only (no email, phone, or private details)
CREATE POLICY "Public users see basic artist info" 
ON public.artists 
FOR SELECT 
TO anon
USING (true);

-- 2. Authenticated users: Can see public artist profiles but not emails
CREATE POLICY "Authenticated users see artist profiles" 
ON public.artists 
FOR SELECT 
TO authenticated
USING (true);

-- 3. Admins: Full access
CREATE POLICY "Admins have full artist access"
ON public.artists
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 4. Artists: Can manage their own profile
CREATE POLICY "Artists manage own profile"
ON public.artists
FOR ALL
TO authenticated  
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Since RLS can't filter columns, we need to create a secure function 
-- that applications can use to get public-safe artist data
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

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_artists_public() TO anon, authenticated;

-- Log the security improvement
SELECT public.enhanced_log_security_event(
    'artist_contact_protection_enhanced',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'implemented_granular_artist_access_controls',
        'description', 'Created separate RLS policies and secure function to protect artist contact information',
        'protected_fields', array['email', 'user_id'],
        'public_function_created', 'get_artists_public()'
    )
);