-- Fix remaining Security Definer issues

-- Drop and recreate the get_artists_public_safe function without SECURITY DEFINER
DROP FUNCTION IF EXISTS public.get_artists_public_safe();

-- Create the function using SECURITY INVOKER (default) instead
CREATE OR REPLACE FUNCTION public.get_artists_public_safe()
RETURNS SETOF public.artists_public_safe
LANGUAGE sql
STABLE
AS $$
    SELECT * FROM public.artists_public_safe;
$$;

-- Update the get_collections_for_user function to be more secure
-- Keep it as SECURITY DEFINER since it needs elevated privileges for admin check
-- but ensure it's properly secured
CREATE OR REPLACE FUNCTION public.get_collections_for_user()
RETURNS TABLE(
    id uuid,
    name text,
    description text,
    external_emails text[],
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Strict security check - only admins can access external emails
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: gallery admin role required to view external emails';
  END IF;
  
  -- Log access attempt for security monitoring
  PERFORM public.enhanced_log_security_event(
    'collections_external_emails_accessed',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
      'user_id', auth.uid(),
      'action', 'admin_accessed_external_emails',
      'timestamp', NOW()
    )
  );
  
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.external_emails,
    c.created_at,
    c.updated_at
  FROM public.collections c;
END;
$$;

-- Create a safe public function for collections without external emails
CREATE OR REPLACE FUNCTION public.get_collections_public()
RETURNS SETOF public.collections_public_safe
LANGUAGE sql
STABLE
AS $$
    SELECT * FROM public.collections_public_safe;
$$;

-- Log the security definer fixes
SELECT public.enhanced_log_security_event(
    'security_definer_views_fixed',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'removed_unnecessary_security_definer',
        'functions_updated', jsonb_build_array(
            'get_artists_public_safe',
            'get_collections_public'
        ),
        'security_improvement', 'reduced_privilege_escalation_risk'
    )
);