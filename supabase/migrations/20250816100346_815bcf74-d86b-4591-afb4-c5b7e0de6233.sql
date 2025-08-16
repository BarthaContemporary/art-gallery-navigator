-- Final security fixes for remaining issues

-- Fix search path for all functions
CREATE OR REPLACE FUNCTION public.get_artists_public_safe()
RETURNS SETOF public.artists_public_safe
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
    SELECT * FROM public.artists_public_safe;
$$;

CREATE OR REPLACE FUNCTION public.get_collections_public()
RETURNS SETOF public.collections_public_safe
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
    SELECT * FROM public.collections_public_safe;
$$;

-- Fix the check_appointment_rate_limit function search path
CREATE OR REPLACE FUNCTION public.check_appointment_rate_limit(client_ip inet)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    recent_count integer;
BEGIN
    -- Check appointments created from this IP in the last hour
    SELECT COUNT(*)
    INTO recent_count
    FROM public.appointments a
    JOIN public.security_events se ON se.details->>'client_ip' = client_ip::text
    WHERE se.created_at > NOW() - INTERVAL '1 hour'
    AND se.event_type = 'appointment_created';
    
    -- Allow max 3 appointments per IP per hour
    RETURN recent_count < 3;
END;
$$;

-- Check for any remaining SECURITY DEFINER views that need to be addressed
-- The vault.decrypted_secrets view is managed by Supabase and cannot be modified
-- Document this as a known system view

-- Log final security hardening completion
SELECT public.enhanced_log_security_event(
    'security_hardening_completed',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'final_security_fixes',
        'fixes_applied', jsonb_build_array(
            'search_path_secured',
            'function_security_hardened',
            'vault_view_documented_as_system_managed'
        ),
        'status', 'security_implementation_complete'
    )
);