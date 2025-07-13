-- Critical Security Fixes Migration
-- Fix privilege escalation vulnerability in user_roles

-- 1. Drop and recreate user_roles policies to fix privilege escalation
DROP POLICY IF EXISTS "Users can view their own roles only" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create secure user_roles policies - users cannot modify their own roles
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

-- 2. Add role change auditing
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

-- 3. Log security enhancement
PERFORM public.enhanced_log_security_event(
  'security_enhancement_applied',
  'info',
  NULL,
  NULL,
  jsonb_build_object(
    'fixes_applied', ARRAY['privilege_escalation_fix', 'role_audit_logging'],
    'timestamp', now()
  )
);