-- FIX SECURITY DEFINER VIEW ISSUE (Alternative Approach)
-- Recreate views without changing ownership but with proper security

-- =============================================================================
-- 1. RECREATE ARTISTS_PUBLIC_SAFE VIEW WITH SECURITY INVOKER
-- =============================================================================

-- Drop and recreate the artists view with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.artists_public_safe CASCADE;

-- Create view with explicit security settings (SECURITY INVOKER is default)
CREATE VIEW public.artists_public_safe 
WITH (security_invoker = true) AS
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

-- Grant access to the view
GRANT SELECT ON public.artists_public_safe TO PUBLIC;
GRANT SELECT ON public.artists_public_safe TO anon;
GRANT SELECT ON public.artists_public_safe TO authenticated;

-- =============================================================================
-- 2. RECREATE COLLECTIONS_PUBLIC_SAFE VIEW WITH SECURITY INVOKER
-- =============================================================================

-- Drop and recreate the collections view with explicit SECURITY INVOKER  
DROP VIEW IF EXISTS public.collections_public_safe CASCADE;

-- Create view with explicit security settings (SECURITY INVOKER is default)
CREATE VIEW public.collections_public_safe
WITH (security_invoker = true) AS
SELECT 
    collections.id,
    collections.name,
    collections.description,
    collections.created_at,
    collections.updated_at
FROM public.collections;

-- Grant access to the view
GRANT SELECT ON public.collections_public_safe TO PUBLIC;
GRANT SELECT ON public.collections_public_safe TO anon;
GRANT SELECT ON public.collections_public_safe TO authenticated;

-- =============================================================================
-- 3. RECREATE FUNCTIONS WITH PROPER SECURITY
-- =============================================================================

-- Recreate functions that use these views
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
-- 4. VERIFY THE FIX
-- =============================================================================

-- Verify views are now properly configured
SELECT 
    'View verification:' as check_type,
    viewname,
    viewowner,
    CASE 
        WHEN definition LIKE '%security_invoker%' THEN 'SECURITY INVOKER'
        ELSE 'DEFAULT (INVOKER)'
    END as security_type
FROM pg_views 
WHERE schemaname = 'public' 
AND viewname IN ('artists_public_safe', 'collections_public_safe');

-- =============================================================================
-- 5. LOG THE SECURITY FIX
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'security_definer_views_fixed_alternative',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'recreated_views_with_security_invoker',
        'views_fixed', jsonb_build_array(
            'artists_public_safe',
            'collections_public_safe'
        ),
        'security_setting', 'explicit_security_invoker',
        'method', 'with_security_invoker_option',
        'status', 'security_definer_view_warnings_should_be_resolved'
    )
);