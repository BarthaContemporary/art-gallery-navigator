
-- Fix the security vulnerability in log_security_event function
-- by setting a secure search_path
DROP FUNCTION IF EXISTS public.log_security_event(text, inet, text, jsonb);

CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _ip_address inet DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _details jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (user_id, event_type, ip_address, user_agent, details)
  VALUES (auth.uid(), _event_type, _ip_address, _user_agent, _details)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;
