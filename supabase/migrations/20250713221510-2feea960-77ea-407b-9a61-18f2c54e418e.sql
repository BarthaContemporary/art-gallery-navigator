-- Fix security vulnerability in log_storage_credential_access function
-- Set immutable search_path to prevent SQL injection attacks

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