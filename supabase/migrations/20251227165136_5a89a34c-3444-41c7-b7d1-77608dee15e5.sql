-- Fix 1: Add rate limiting to appointments INSERT policy
-- Drop existing unrestricted INSERT policy
DROP POLICY IF EXISTS "appointments_booking_insert_only" ON public.appointments;

-- Create rate limiting function for appointments
CREATE OR REPLACE FUNCTION public.check_appointment_email_rate_limit(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Check appointments from this email in the last hour
  SELECT COUNT(*) INTO recent_count
  FROM public.appointments
  WHERE client_email = p_email
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Allow max 3 appointments per email per hour
  RETURN recent_count < 3;
END;
$$;

-- Create new rate-limited INSERT policy for appointments
CREATE POLICY "appointments_booking_insert_rate_limited"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  client_name IS NOT NULL 
  AND client_email IS NOT NULL
  AND start_datetime IS NOT NULL
  AND end_datetime IS NOT NULL
  AND start_datetime > NOW()
  AND end_datetime > start_datetime
  AND check_appointment_email_rate_limit(client_email)
);

-- Fix 2: Restrict publication_leads access to admins only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.publication_leads;
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.publication_leads;

-- Grant INSERT only via service role (edge function uses service role key)
-- This prevents direct client-side inserts while allowing the edge function to work
CREATE POLICY "Service role can insert leads"
ON public.publication_leads
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only admins can view leads (contains sensitive PII)
CREATE POLICY "Admins can view leads"
ON public.publication_leads
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Admins can manage leads
CREATE POLICY "Admins can manage leads"
ON public.publication_leads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));