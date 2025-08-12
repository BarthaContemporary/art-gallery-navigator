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

-- Secure the clients table - ensure only admins can access client data
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage clients" ON public.clients;

CREATE POLICY "Admins can manage all client data"
ON public.clients
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Secure the appointments table - ensure only admins can access
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only admins can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only admins can delete appointments" ON public.appointments;

CREATE POLICY "Admins can manage all appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Allow public users to create appointments (booking system)
CREATE POLICY "Public can create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Log the security improvements
SELECT public.enhanced_log_security_event(
    'database_security_hardened',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'secured_sensitive_data_access',
        'description', 'Implemented strict RLS policies for clients and appointments tables',
        'secured_tables', array['clients', 'appointments'],
        'admin_only_access', true
    )
);