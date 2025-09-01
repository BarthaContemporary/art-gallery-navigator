-- Create secure admin-only function for artist contact information
CREATE OR REPLACE FUNCTION public.get_artist_contacts_admin_only()
RETURNS TABLE(id UUID, full_name TEXT, email TEXT, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Strict admin check
    IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
        RAISE EXCEPTION 'Access denied: Gallery admin role required to access artist contact information';
    END IF;
    
    RETURN QUERY
    SELECT a.id, a.full_name, a.email, a.user_id
    FROM public.artists a
    WHERE a.email IS NOT NULL
    ORDER BY a.full_name;
END;
$$;

-- Log security fix deployment
INSERT INTO public.security_events (
    user_id, 
    event_type, 
    details
) VALUES (
    auth.uid(),
    'artist_contact_security_fix_deployed_high',
    jsonb_build_object(
        'action', 'deployed_secure_artist_contact_access',
        'description', 'Artist contact information now requires admin role to access',
        'function_created', 'get_artist_contacts_admin_only',
        'security_level', 'admin_only',
        'severity', 'high'
    )
);