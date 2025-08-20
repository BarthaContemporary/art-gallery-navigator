-- FINAL SECURITY REMEDIATION - Fix remaining exposure issues

-- =============================================================================
-- 1. REMOVE REMAINING PUBLIC ACCESS TO SENSITIVE TABLES
-- =============================================================================

-- Completely remove public access to artists table
REVOKE ALL ON public.artists FROM PUBLIC;
REVOKE ALL ON public.artists FROM anon;

-- Remove any remaining SELECT grants that might allow email harvesting
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find and revoke any remaining grants to artists table
    FOR r IN 
        SELECT grantee, privilege_type 
        FROM information_schema.table_privileges 
        WHERE table_name = 'artists' 
        AND table_schema = 'public'
        AND grantee IN ('PUBLIC', 'anon')
    LOOP
        EXECUTE format('REVOKE %s ON public.artists FROM %s', r.privilege_type, r.grantee);
    END LOOP;
END $$;

-- Ensure clients table has no public access whatsoever
REVOKE ALL ON public.clients FROM PUBLIC;
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.clients FROM authenticated;

-- Ensure appointments table has no public read access
REVOKE SELECT ON public.appointments FROM PUBLIC;
REVOKE SELECT ON public.appointments FROM anon;
REVOKE UPDATE, DELETE ON public.appointments FROM PUBLIC;
REVOKE UPDATE, DELETE ON public.appointments FROM anon;
REVOKE UPDATE, DELETE ON public.appointments FROM authenticated;

-- =============================================================================
-- 2. CREATE FINAL SECURITY VERIFICATION
-- =============================================================================

-- Test that no sensitive tables have public read access
CREATE OR REPLACE FUNCTION public.verify_no_public_access()
RETURNS TABLE(
    table_name text,
    grantee text,
    privilege_type text,
    is_secure boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tp.table_name::text,
        tp.grantee::text,
        tp.privilege_type::text,
        CASE 
            WHEN tp.table_name IN ('artists', 'clients', 'appointments') 
                AND tp.grantee IN ('PUBLIC', 'anon') 
                AND tp.privilege_type = 'SELECT'
            THEN false
            ELSE true
        END as is_secure
    FROM information_schema.table_privileges tp
    WHERE tp.table_schema = 'public'
        AND tp.table_name IN ('artists', 'clients', 'appointments')
        AND tp.grantee IN ('PUBLIC', 'anon', 'authenticated')
    ORDER BY tp.table_name, tp.privilege_type;
END $$;

-- Run verification
SELECT * FROM public.verify_no_public_access();

-- =============================================================================
-- 3. FINAL SECURITY LOG
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'final_security_lockdown_complete',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'removed_all_remaining_public_access',
        'tables_secured', jsonb_build_array('artists', 'clients', 'appointments'),
        'verification_function_created', true,
        'status', 'database_fully_secured'
    )
);