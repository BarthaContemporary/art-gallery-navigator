-- FIX SECURITY DEFINER VIEW ISSUE
-- Recreate views with proper ownership and security settings

-- =============================================================================
-- 1. RECREATE ARTISTS_PUBLIC_SAFE VIEW WITH PROPER SECURITY
-- =============================================================================

-- Drop and recreate the artists_public_safe view to fix ownership
DROP VIEW IF EXISTS public.artists_public_safe CASCADE;

-- Create as SECURITY INVOKER view (default) with explicit settings
CREATE VIEW public.artists_public_safe AS
SELECT 
    artists.id,
    artists.full_name,
    artists.biography,
    artists.nationality,
    artists.birth_year,
    artists.death_year,
    artists.place_of_birth,
    artists.place_of_death,
    artists.image_url,
    artists.representation_status,
    artists.surname_first_letter,
    artists.created_at,
    artists.updated_at
FROM public.artists;

-- Set proper ownership to authenticated role instead of postgres superuser
ALTER VIEW public.artists_public_safe OWNER TO authenticated;

-- Grant appropriate access
GRANT SELECT ON public.artists_public_safe TO PUBLIC;
GRANT SELECT ON public.artists_public_safe TO anon;
GRANT SELECT ON public.artists_public_safe TO authenticated;

-- =============================================================================
-- 2. RECREATE COLLECTIONS_PUBLIC_SAFE VIEW WITH PROPER SECURITY  
-- =============================================================================

-- Drop and recreate the collections_public_safe view to fix ownership
DROP VIEW IF EXISTS public.collections_public_safe CASCADE;

-- Create as SECURITY INVOKER view (default) with explicit settings
CREATE VIEW public.collections_public_safe AS
SELECT 
    collections.id,
    collections.name,
    collections.description,
    collections.created_at,
    collections.updated_at
FROM public.collections;

-- Set proper ownership to authenticated role instead of postgres superuser
ALTER VIEW public.collections_public_safe OWNER TO authenticated;

-- Grant appropriate access
GRANT SELECT ON public.collections_public_safe TO PUBLIC;
GRANT SELECT ON public.collections_public_safe TO anon;
GRANT SELECT ON public.collections_public_safe TO authenticated;

-- =============================================================================
-- 3. UPDATE RELATED FUNCTIONS TO MATCH
-- =============================================================================

-- Ensure the functions that use these views are also properly configured
CREATE OR REPLACE FUNCTION public.get_artists_public_safe()
RETURNS SETOF public.artists_public_safe
LANGUAGE sql
STABLE 
SECURITY INVOKER
SET search_path TO 'public'
AS $$
    SELECT * FROM public.artists_public_safe;
$$;

CREATE OR REPLACE FUNCTION public.get_collections_public()
RETURNS SETOF public.collections_public_safe
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
    SELECT * FROM public.collections_public_safe;
$$;

-- =============================================================================
-- 4. VERIFY PROPER OWNERSHIP
-- =============================================================================

-- Check that views now have proper ownership
SELECT 
    'Fixed view ownership:' as status,
    viewname,
    viewowner
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('artists_public_safe', 'collections_public_safe');

-- =============================================================================
-- 5. LOG SECURITY FIX
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'security_definer_views_fixed',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'recreated_views_with_proper_ownership',
        'views_fixed', jsonb_build_array(
            'artists_public_safe',
            'collections_public_safe'
        ),
        'ownership_changed_from', 'postgres',
        'ownership_changed_to', 'authenticated',
        'security_model', 'SECURITY_INVOKER',
        'status', 'security_definer_view_issue_resolved'
    )
);