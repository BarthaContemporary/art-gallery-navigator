-- Critical Security Fix: Secure cloud storage credentials from unauthorized access

-- First, ensure RLS is enabled on all storage credential tables
ALTER TABLE public.admin_storage_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_storage_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Remove any existing overly permissive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_storage_credentials;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.admin_storage_credentials;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.admin_storage_credentials;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.admin_storage_credentials;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.artist_storage_credentials;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.artist_storage_credentials;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.artist_storage_credentials;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.artist_storage_credentials;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.shared_storage_credentials;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.shared_storage_credentials;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.shared_storage_credentials;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.shared_storage_credentials;

-- Secure admin_storage_credentials: Only gallery admins can access their own credentials
CREATE POLICY "Admins can manage their own admin storage credentials"
ON public.admin_storage_credentials
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid());

-- Secure artist_storage_credentials: Only gallery admins and the specific artist can access
CREATE POLICY "Artists and admins can view artist storage credentials"
ON public.artist_storage_credentials
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gallery_admin'::user_role) OR 
  EXISTS (
    SELECT 1 FROM public.artists 
    WHERE artists.id = artist_storage_credentials.artist_id 
    AND artists.user_id = auth.uid()
  )
);

CREATE POLICY "Only admins can insert artist storage credentials"
ON public.artist_storage_credentials
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Only admins can update artist storage credentials"
ON public.artist_storage_credentials
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Only admins can delete artist storage credentials"
ON public.artist_storage_credentials
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Secure shared_storage_credentials: Only gallery admins can access
CREATE POLICY "Only admins can manage shared storage credentials"
ON public.shared_storage_credentials
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Add logging to track access to storage credentials for security monitoring
CREATE OR REPLACE FUNCTION public.log_storage_credential_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log access to storage credentials for security monitoring
  PERFORM public.enhanced_log_security_event(
    'storage_credential_access',
    'info',
    NULL,
    NULL,
    jsonb_build_object(
      'credential_type', TG_TABLE_NAME,
      'credential_id', CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.id 
        ELSE NEW.id 
      END,
      'operation', TG_OP
    )
  );
  
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Add triggers to monitor access to storage credentials
DROP TRIGGER IF EXISTS log_admin_storage_credential_access ON public.admin_storage_credentials;
CREATE TRIGGER log_admin_storage_credential_access
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

DROP TRIGGER IF EXISTS log_artist_storage_credential_access ON public.artist_storage_credentials;
CREATE TRIGGER log_artist_storage_credential_access
  AFTER INSERT OR UPDATE OR DELETE ON public.artist_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

DROP TRIGGER IF EXISTS log_shared_storage_credential_access ON public.shared_storage_credentials;
CREATE TRIGGER log_shared_storage_credential_access
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

-- Log the security fix
SELECT public.enhanced_log_security_event(
    'storage_credentials_vulnerability_fixed',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'secured_storage_credentials',
        'description', 'All cloud storage credential tables now have proper RLS policies to prevent unauthorized access',
        'security_improvement', 'credential_protection',
        'tables_secured', array[
            'admin_storage_credentials',
            'artist_storage_credentials', 
            'shared_storage_credentials'
        ],
        'access_control', 'admin_and_owner_only'
    )
);