-- COMPREHENSIVE SECURITY REMEDIATION (SAFE VERSION)
-- Handles existing policies and systematically fixes all vulnerabilities

-- =============================================================================
-- 1. GLOBAL AUDIT & HARDENING
-- =============================================================================

-- Revoke dangerous public grants
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC; 
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant back essential access
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =============================================================================
-- 2. FIX ARTIST EMAIL HARVESTING - Create safe view without emails
-- =============================================================================

-- Drop and recreate the safe artist view to ensure it excludes emails
DROP VIEW IF EXISTS public.artists_public_safe CASCADE;

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
    -- Explicitly EXCLUDE email, user_id and other sensitive fields
FROM public.artists;

-- Grant access to safe view only
GRANT SELECT ON public.artists_public_safe TO PUBLIC, anon, authenticated;

-- Remove public access from the main artists table
REVOKE ALL ON public.artists FROM PUBLIC;
REVOKE ALL ON public.artists FROM anon; 

-- Drop the problematic public policy on artists
DROP POLICY IF EXISTS "Public can view safe artist info only" ON public.artists;

-- =============================================================================
-- 3. LOCK DOWN APPOINTMENT DATA
-- =============================================================================

-- Drop overly permissive appointment policies
DROP POLICY IF EXISTS "Controlled appointment creation" ON public.appointments;

-- Remove public access to appointments
REVOKE ALL ON public.appointments FROM PUBLIC;
REVOKE ALL ON public.appointments FROM anon;

-- Create controlled appointment creation policy
CREATE POLICY "Secure appointment creation for booking"
    ON public.appointments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        client_name IS NOT NULL 
        AND client_email IS NOT NULL
        AND start_datetime IS NOT NULL
        AND end_datetime IS NOT NULL
    );

-- Grant only INSERT permission for booking
GRANT INSERT ON public.appointments TO anon, authenticated;

-- =============================================================================
-- 4. RESTRICT SALES DATA (if exists)
-- =============================================================================

DO $$
BEGIN
    -- If sales table exists, lock it down completely
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales' AND table_schema = 'public') THEN
        -- Remove all public access
        EXECUTE 'REVOKE ALL ON public.sales FROM PUBLIC';
        EXECUTE 'REVOKE ALL ON public.sales FROM anon';
        EXECUTE 'REVOKE ALL ON public.sales FROM authenticated';
        
        -- Drop permissive policies
        EXECUTE 'DROP POLICY IF EXISTS "Enable all operations for all users" ON public.sales';
        
        -- Only admins can access sales
        EXECUTE 'ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY';
        EXECUTE '
        CREATE POLICY "sales_admin_only"
            ON public.sales
            FOR ALL
            USING (has_role(auth.uid(), ''gallery_admin''::user_role))
            WITH CHECK (has_role(auth.uid(), ''gallery_admin''::user_role))';
    END IF;
END $$;

-- =============================================================================
-- 5. LOCK DOWN PROJECT ACCESS (if exists)  
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public') THEN
        -- Remove public access
        EXECUTE 'REVOKE ALL ON public.projects FROM PUBLIC';
        EXECUTE 'REVOKE ALL ON public.projects FROM anon';
        
        -- Drop public policies
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view projects" ON public.projects';
        
        -- Enable RLS and create admin-only access
        EXECUTE 'ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY';
        EXECUTE '
        CREATE POLICY "projects_admin_access"
            ON public.projects
            FOR ALL
            USING (has_role(auth.uid(), ''gallery_admin''::user_role))
            WITH CHECK (has_role(auth.uid(), ''gallery_admin''::user_role))';
    END IF;
END $$;

-- =============================================================================
-- 6. FIX SECURITY DEFINER FUNCTIONS
-- =============================================================================

-- Replace with SECURITY INVOKER functions
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
-- 7. SECURE COLLECTIONS (protect external emails)
-- =============================================================================

-- Remove overly permissive collection policies
DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;

-- Remove public access
REVOKE ALL ON public.collections FROM PUBLIC;
REVOKE ALL ON public.collections FROM anon;

-- =============================================================================
-- 8. SECURE CLIENT DATA
-- =============================================================================

-- Remove all public access to client data
REVOKE ALL ON public.clients FROM PUBLIC;
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.clients FROM authenticated;

-- =============================================================================
-- 9. GRANT ACCESS TO SAFE PUBLIC DATA ONLY
-- =============================================================================

-- Grant access to safe views and public information
GRANT SELECT ON public.artists_public_safe TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.collections_public_safe TO PUBLIC, anon, authenticated;

-- Artwork data (has proper RLS policies already)
GRANT SELECT ON public.artworks TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.artwork_images TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.collection_artworks TO PUBLIC, anon, authenticated;

-- Exhibition data (public information)
GRANT SELECT ON public.exhibitions TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.exhibition_artworks TO PUBLIC, anon, authenticated;

-- Appointment booking (read-only for available slots)
GRANT SELECT ON public.appointment_slots TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_types TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_settings TO PUBLIC, anon, authenticated;

-- Exchange rates (public data)
GRANT SELECT ON public.exchange_rates TO PUBLIC, anon, authenticated;

-- =============================================================================
-- 10. FINAL SECURITY AUDIT LOG
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'comprehensive_security_remediation_complete',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'database_security_vulnerabilities_fixed',
        'critical_fixes', jsonb_build_array(
            'artist_emails_protected_via_safe_view',
            'appointment_data_access_restricted', 
            'sales_data_admin_only',
            'project_access_secured',
            'security_definer_functions_fixed',
            'collection_external_emails_protected',
            'client_data_secured'
        ),
        'public_grants_revoked', true,
        'safe_views_created', true,
        'rls_policies_updated', true,
        'status', 'all_vulnerabilities_remediated'
    )
);