-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Prevent users from modifying their own roles unless they're admin
  IF NEW.user_id = auth.uid() AND NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Users cannot modify their own roles';
  END IF;
  
  -- Log role changes for audit
  PERFORM public.enhanced_log_security_event(
    'role_modification_attempt',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
      'target_user_id', NEW.user_id,
      'new_role', NEW.role,
      'old_role', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END,
      'modified_by', auth.uid(),
      'operation', TG_OP
    )
  );
  
  RETURN NEW;
END;
$$;