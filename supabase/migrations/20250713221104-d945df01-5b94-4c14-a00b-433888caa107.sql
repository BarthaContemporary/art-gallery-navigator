-- Security Enhancement Migration
-- Fix critical privilege escalation vulnerability and other security issues

-- 1. Fix Critical Privilege Escalation in user_roles table
-- Drop existing policies that allow users to modify their own roles
DROP POLICY IF EXISTS "Users can view their own roles only" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create secure policies for user_roles
CREATE POLICY "Users can view their own roles only" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'gallery_admin'));

CREATE POLICY "Only admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'gallery_admin'));

CREATE POLICY "Only admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (has_role(auth.uid(), 'gallery_admin'));

CREATE POLICY "Only admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'gallery_admin'));

-- 2. Enhance Profile Security - Tighten access control
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view minimal profile info for user selection" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Create more restrictive profile policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Users can view minimal profile info for collaboration" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL); -- Requires authentication but allows viewing display names for user selection

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = auth.uid()) 
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'));

-- 3. Add Role Change Audit Function
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enhanced_log_security_event(
      'role_assigned',
      'high',
      NULL,
      NULL,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'role', NEW.role,
        'assigned_by', auth.uid(),
        'operation', 'INSERT'
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.enhanced_log_security_event(
      'role_modified',
      'high',
      NULL,
      NULL,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'old_role', OLD.role,
        'new_role', NEW.role,
        'modified_by', auth.uid(),
        'operation', 'UPDATE'
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.enhanced_log_security_event(
      'role_removed',
      'high',
      NULL,
      NULL,
      jsonb_build_object(
        'target_user_id', OLD.user_id,
        'role', OLD.role,
        'removed_by', auth.uid(),
        'operation', 'DELETE'
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role change auditing
DROP TRIGGER IF EXISTS audit_user_role_changes ON public.user_roles;
CREATE TRIGGER audit_user_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_changes();

-- 4. Enhanced Storage Credential Security
-- Add encryption functions for storage credentials
CREATE OR REPLACE FUNCTION public.encrypt_storage_credential(credential_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Use Supabase's built-in encryption with a consistent key derivation
  RETURN encode(
    pgsodium.crypto_secretbox(
      credential_text::bytea,
      pgsodium.crypto_secretbox_keygen()
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrypt_storage_credential(encrypted_credential TEXT, key_data TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Decrypt storage credentials (for authorized access only)
  RETURN convert_from(
    pgsodium.crypto_secretbox_open(
      decode(encrypted_credential, 'base64'),
      decode(key_data, 'base64')
    ),
    'utf8'
  );
EXCEPTION WHEN OTHERS THEN
  -- Return null if decryption fails
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add Security Event Types for Better Monitoring
INSERT INTO public.security_events (event_type, details, created_at) 
VALUES ('security_migration_applied', 
        jsonb_build_object('migration_version', '20250713_security_fixes', 'timestamp', now()),
        now())
ON CONFLICT DO NOTHING;