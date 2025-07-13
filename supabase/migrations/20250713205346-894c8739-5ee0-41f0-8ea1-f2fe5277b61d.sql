-- Security Enhancement: Clean up redundant policies and tighten access control

-- 1. Clean up redundant profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles for selection" ON public.profiles;

-- Keep the essential profile policies and add missing ones
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- 2. Clean up redundant user_roles policies  
DROP POLICY IF EXISTS "Authenticated users can read all user roles for selection" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- 3. Clean up redundant artworks policies (keep only the most comprehensive ones)
DROP POLICY IF EXISTS "Anyone can view artworks" ON public.artworks;
DROP POLICY IF EXISTS "Public can read all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Users can view artworks if they are admin or owning artist" ON public.artworks;
DROP POLICY IF EXISTS "Artists can view their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can view all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can create artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can insert all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Admins can update all artworks" ON public.artworks; 
DROP POLICY IF EXISTS "Admins can delete all artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can update their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can delete their own artworks" ON public.artworks;

-- Keep the consolidated policies that cover all cases
-- "Anyone can view available artworks" - covers public viewing
-- "Artists can create their own artworks" - covers artist creation  
-- "Artists can manage their own artworks" - covers artist management
-- "Admins can manage all artworks" - covers admin access

-- 4. Add storage credential audit logging
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
DROP TRIGGER IF EXISTS audit_admin_storage_credentials ON public.admin_storage_credentials;
DROP TRIGGER IF EXISTS audit_artist_storage_credentials ON public.artist_storage_credentials;
DROP TRIGGER IF EXISTS audit_shared_storage_credentials ON public.shared_storage_credentials;

CREATE TRIGGER audit_admin_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

CREATE TRIGGER audit_artist_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.artist_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();

CREATE TRIGGER audit_shared_storage_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_storage_credentials
  FOR EACH ROW EXECUTE FUNCTION public.log_storage_credential_access();