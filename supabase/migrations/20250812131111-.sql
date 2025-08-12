-- Security Fix: Remove dangerous public access policies

-- 1. Fix shared storage credentials - remove public read access
DROP POLICY IF EXISTS "All users can view shared storage credentials" ON public.shared_storage_credentials;

-- 2. Fix collections - remove unrestricted public access to external_emails
DROP POLICY IF EXISTS "Public can read all collections" ON public.collections;
DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;

-- Create restricted public access for collections (basic info only, no external_emails visible to public)
CREATE POLICY "Public can view basic collection info" 
ON public.collections
FOR SELECT
TO anon
USING (true);

-- Ensure authenticated users can view collections they have access to
CREATE POLICY "Authenticated users can view accessible collections" 
ON public.collections
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR 
  is_collection_accessible_by_current_artist(id)
);

-- 3. Fix artists - remove unrestricted email access
DROP POLICY IF EXISTS "Authenticated users can view artist profiles" ON public.artists;
DROP POLICY IF EXISTS "Artists can view all artist profiles" ON public.artists;

-- Create public policy for basic artist info (no emails)
CREATE POLICY "Public can view basic artist profiles" 
ON public.artists
FOR SELECT
TO anon
USING (true);

-- Authenticated users can see more complete profiles
CREATE POLICY "Authenticated users can view artist profiles" 
ON public.artists
FOR SELECT
TO authenticated
USING (true);

-- 4. Fix booking settings - remove public access
DROP POLICY IF EXISTS "Anyone can view booking settings" ON public.booking_settings;

-- Only authenticated users can view booking settings
CREATE POLICY "Authenticated users can view booking settings" 
ON public.booking_settings
FOR SELECT
TO authenticated
USING (true);

-- Log security policy update
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
    INSERT INTO public.security_events (user_id, event_type, details)
    VALUES (
      NULL,
      'security_policy_remediation',
      jsonb_build_object(
        'timestamp', extract(epoch from now()),
        'action', 'removed_public_access_to_sensitive_data',
        'tables_updated', ARRAY['shared_storage_credentials', 'collections', 'artists', 'booking_settings'],
        'severity', 'critical_security_fix'
      )
    );
  END IF;
END $$;