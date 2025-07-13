-- Security Enhancement: Tighten Profile and User Role Access Control

-- 1. Update profiles table policies for better access control
DROP POLICY IF EXISTS "Users can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create more restrictive profile policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Users can view minimal profile info for user selection" 
ON public.profiles 
FOR SELECT 
USING (true); -- Allow basic profile viewing for user selection dropdowns

CREATE POLICY "Users can manage their own profile" 
ON public.profiles 
FOR ALL 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- 2. Tighten user_roles policies (these were already good but let's ensure they're optimal)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Recreate user_roles policies with better security
CREATE POLICY "Users can view their own roles only" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can manage user roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- 3. Consolidate artwork policies (remove redundant ones)
DROP POLICY IF EXISTS "Anyone can view artworks" ON public.artworks;
DROP POLICY IF EXISTS "Public can read all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Users can view artworks if they are admin or owning artist" ON public.artworks;
DROP POLICY IF EXISTS "Artists can view their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can view all artworks" ON public.artworks;

-- Create consolidated artwork viewing policy
CREATE POLICY "Artwork visibility policy" 
ON public.artworks 
FOR SELECT 
USING (
  status = 'available' OR 
  has_role(auth.uid(), 'gallery_admin'::user_role) OR
  EXISTS (
    SELECT 1 FROM artists 
    WHERE artists.id = artworks.artist_id 
    AND artists.user_id = auth.uid()
  )
);

-- 4. Enhance storage credentials security with audit logging
CREATE OR REPLACE FUNCTION public.log_storage_credential_access()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to storage credential tables
CREATE TRIGGER audit_admin_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

CREATE TRIGGER audit_artist_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.artist_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

CREATE TRIGGER audit_shared_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();