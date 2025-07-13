-- Create the enhanced_log_security_event function
CREATE OR REPLACE FUNCTION public.enhanced_log_security_event(
  _event_type TEXT,
  _severity TEXT DEFAULT 'info',
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  event_id UUID;
  current_user_id UUID := auth.uid();
BEGIN
  -- Enhanced logging with severity levels
  INSERT INTO public.security_events (
    user_id, 
    event_type, 
    ip_address, 
    user_agent, 
    details
  )
  VALUES (
    current_user_id, 
    _event_type || '_' || _severity,
    _ip_address, 
    _user_agent, 
    jsonb_build_object(
      'severity', _severity,
      'timestamp', extract(epoch from now()),
      'user_id', current_user_id,
      'details', _details
    )
  )
  RETURNING id INTO event_id;
  
  -- Alert on critical events
  IF _severity = 'critical' THEN
    -- Log critical event for monitoring
    RAISE LOG 'CRITICAL SECURITY EVENT: % for user % from IP %', 
      _event_type, current_user_id, _ip_address;
  END IF;
  
  RETURN event_id;
END;
$$;