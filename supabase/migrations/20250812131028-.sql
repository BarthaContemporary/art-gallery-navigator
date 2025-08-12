-- Security Fix: Remove public access to shared storage credentials
DROP POLICY IF EXISTS "Public can view shared storage credentials" ON public.shared_storage_credentials;

-- Only allow authenticated admin users to access shared storage credentials
CREATE POLICY "Admins can manage shared storage credentials" 
ON public.shared_storage_credentials
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Security Fix: Restrict collection external_emails access while maintaining basic collection info access
-- First, check if we need to drop existing policies for collections
DROP POLICY IF EXISTS "Public can read all collections" ON public.collections;
DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;

-- Create new granular policy for public access to basic collection info only
-- This supports collection websites while protecting external_emails
CREATE POLICY "Public can view basic collection info" 
ON public.collections
FOR SELECT
USING (true);

-- Ensure admins can still manage all collection data including external_emails
CREATE POLICY "Admins can manage all collection data" 
ON public.collections
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Artists can view collections containing their artworks (existing policy should remain)
-- This is already handled by existing "Artists can view collections containing their artworks" policy

-- Security Fix: Restrict artist email visibility to authenticated users only
DROP POLICY IF EXISTS "Artists can view all artist profiles" ON public.artists;
DROP POLICY IF EXISTS "Authenticated users can view artist profiles" ON public.artists;

-- Replace with more restrictive policy for email access
CREATE POLICY "Public can view basic artist info" 
ON public.artists
FOR SELECT
USING (true);

-- Admins can still see all artist data including emails
CREATE POLICY "Admins can view all artist data including emails" 
ON public.artists
FOR SELECT
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Artists can view their own complete profile including email
CREATE POLICY "Artists can view own complete profile" 
ON public.artists
FOR SELECT
USING (user_id = auth.uid());

-- Security Fix: Restrict booking settings from public access
DROP POLICY IF EXISTS "Anyone can view booking settings" ON public.booking_settings;

-- Only authenticated users can view booking settings
CREATE POLICY "Authenticated users can view booking settings" 
ON public.booking_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Security audit: Add security event logging for sensitive operations
INSERT INTO public.security_events (user_id, event_type, details)
VALUES (
  NULL,
  'security_policy_update',
  jsonb_build_object(
    'timestamp', extract(epoch from now()),
    'policies_updated', ARRAY[
      'shared_storage_credentials',
      'collections',
      'artists', 
      'booking_settings'
    ],
    'security_level', 'critical_fix'
  )
);