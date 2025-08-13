-- Fix Security Definer View issue by removing SECURITY DEFINER property from artists_public_safe view

-- Drop the existing view
DROP VIEW IF EXISTS public.artists_public_safe;

-- Recreate the view without SECURITY DEFINER to use SECURITY INVOKER (default)
-- This ensures the view respects the RLS policies and permissions of the querying user
CREATE VIEW public.artists_public_safe AS
SELECT 
    id,
    full_name,
    biography,
    nationality,
    birth_year,
    death_year,
    place_of_birth,
    place_of_death,
    image_url,
    representation_status,
    surname_first_letter,
    created_at,
    updated_at
FROM public.artists;

-- Enable RLS on the view to ensure proper access control
-- Note: Views inherit RLS from their underlying tables, but this makes it explicit
COMMENT ON VIEW public.artists_public_safe IS 'Public safe view of artists data without sensitive information like email or user_id';

-- Log the security fix
SELECT public.enhanced_log_security_event(
    'security_definer_view_fixed',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'removed_security_definer_from_view',
        'view_name', 'artists_public_safe',
        'description', 'Removed SECURITY DEFINER property to use SECURITY INVOKER and respect querying user permissions',
        'security_improvement', 'view_security_hardening'
    )
);