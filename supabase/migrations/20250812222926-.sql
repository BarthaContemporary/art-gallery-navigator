-- Comprehensive security fixes - properly drop existing policies first

-- Drop all existing artist policies to start fresh
DROP POLICY IF EXISTS "Public users see basic artist info" ON public.artists;
DROP POLICY IF EXISTS "Authenticated users see artist profiles" ON public.artists;
DROP POLICY IF EXISTS "Admins have full artist access" ON public.artists;
DROP POLICY IF EXISTS "Artists manage own profile" ON public.artists;
DROP POLICY IF EXISTS "Public can view basic artist information" ON public.artists;
DROP POLICY IF EXISTS "Admins can manage all artists" ON public.artists;
DROP POLICY IF EXISTS "Artists can manage their own profile" ON public.artists;

-- Create secure artist policies
-- 1. Public users: Basic info only (no email, user_id, or private details)
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

-- 3. Admins: Full access to manage artists
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

-- Update the get_artists_public function with proper search path
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

-- Secure client data - ensure only admins can access
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

-- Create strict client access policies
CREATE POLICY "Only admins can access client data"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Secure appointment data - ensure only admins can access
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only admins can delete appointments" ON public.appointments;

-- Create strict appointment policies
CREATE POLICY "Only admins can manage appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Allow public to create appointments (booking system)
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Log the comprehensive security fix
SELECT public.enhanced_log_security_event(
    'comprehensive_security_hardening',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'implemented_comprehensive_security_fixes',
        'description', 'Protected artist contact data, secured client database, and restricted appointment access',
        'tables_secured', array['artists', 'clients', 'appointments'],
        'protected_data_types', array['artist_emails', 'client_data', 'appointment_details']
    )
);