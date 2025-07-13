-- Fix security vulnerability in audit_role_changes function
-- Set immutable search_path to prevent SQL injection attacks

CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
$$;