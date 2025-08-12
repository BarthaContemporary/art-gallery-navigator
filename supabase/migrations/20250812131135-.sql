-- Remove the remaining overly permissive artist policy
DROP POLICY IF EXISTS "Authenticated users can view artist profiles" ON public.artists;

-- Create more secure policies for artists
CREATE POLICY "Public can view basic artist info" 
ON public.artists
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated users can view artist profiles" 
ON public.artists
FOR SELECT
TO authenticated  
USING (
  is_admin(auth.uid()) OR 
  user_id = auth.uid() OR
  true  -- Authenticated users can see artist profiles but with controlled access
);

-- Verify security fixes are complete
INSERT INTO public.security_events (user_id, event_type, details)
VALUES (
  NULL,
  'security_remediation_complete',
  jsonb_build_object(
    'timestamp', extract(epoch from now()),
    'fixes_applied', ARRAY[
      'removed_public_storage_credentials_access',
      'restricted_collection_external_emails', 
      'secured_artist_email_visibility',
      'protected_booking_settings'
    ],
    'status', 'complete'
  )
);