-- Security Fix 1: Tighten User Role Visibility
-- Drop existing overly permissive policies on user_roles
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.user_roles;

-- Create restrictive policies for user_roles
CREATE POLICY "Users can view their own roles" 
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

-- Security Fix 2: Enhance Profiles Access Control
-- Drop overly broad profile policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.profiles;

-- Create more restrictive profile policies
CREATE POLICY "Users can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (true); -- Basic info like display_name can be public for user interactions

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

-- Security Fix 3: Remove redundant/overly broad policies
-- Clean up clients table policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.clients;

-- Clean up exhibitions table policies  
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.exhibitions;

-- Clean up exhibition_artworks table policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.exhibition_artworks;

-- Security Fix 4: Enhance security event logging
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