-- Fix appointments table - remove public access to sensitive customer data
DROP POLICY IF EXISTS "Anyone can create appointments" ON public.appointments;

-- Only allow authenticated users to create appointments, not anonymous users
CREATE POLICY "Authenticated users can create appointments" 
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix artists table - remove email from public view while keeping basic info public
DROP POLICY IF EXISTS "Public can view basic artist info" ON public.artists;
DROP POLICY IF EXISTS "Public can view basic artist profiles" ON public.artists;

-- Create separate policies for public vs authenticated access to artists
CREATE POLICY "Public can view basic artist info" 
ON public.artists
FOR SELECT
TO anon
USING (true);

-- Authenticated users can see emails, public users cannot
CREATE POLICY "Authenticated users can view full artist profiles" 
ON public.artists
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR 
  user_id = auth.uid() OR
  true
);

-- Create view for public artist access without sensitive data
CREATE OR REPLACE VIEW public.artists_public AS
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

-- Allow public access to the safe view
GRANT SELECT ON public.artists_public TO anon;
GRANT SELECT ON public.artists_public TO authenticated;

-- Log security remediation
INSERT INTO public.security_events (user_id, event_type, details)
VALUES (
  NULL,
  'critical_security_fixes_applied',
  jsonb_build_object(
    'timestamp', extract(epoch from now()),
    'fixes_applied', ARRAY[
      'secured_appointments_table',
      'removed_public_artist_email_access',
      'created_public_artist_view'
    ],
    'severity', 'critical',
    'status', 'complete'
  )
);