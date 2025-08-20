-- DATABASE SECURITY VERIFICATION SCRIPT
-- Run this to verify security hardening is complete

-- =============================================================================
-- 1. CHECK SECURITY DEFINER VIEWS/FUNCTIONS
-- =============================================================================

SELECT 'SECURITY DEFINER VIEWS/FUNCTIONS:' as check_type;
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    p.prosecdef as is_security_definer,
    p.prokind as function_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
    AND n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY n.nspname, p.proname;

-- =============================================================================
-- 2. CHECK RLS STATUS ON ALL TABLES
-- =============================================================================

SELECT 'ROW LEVEL SECURITY STATUS:' as check_type;
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- =============================================================================
-- 3. CHECK PUBLIC GRANTS (Should be minimal)
-- =============================================================================

SELECT 'PUBLIC PRIVILEGES:' as check_type;
SELECT 
    table_schema,
    table_name,
    privilege_type,
    grantee,
    CASE 
        WHEN grantee = 'PUBLIC' THEN '⚠️ PUBLIC ACCESS'
        WHEN grantee = 'anon' THEN '⚠️ ANONYMOUS ACCESS'
        ELSE '✅ CONTROLLED ACCESS'
    END as access_level
FROM information_schema.table_privileges
WHERE grantee IN ('PUBLIC', 'anon', 'authenticated')
    AND table_schema = 'public'
ORDER BY table_name, privilege_type;

-- =============================================================================
-- 4. TEST ACCESS AS DIFFERENT ROLES
-- =============================================================================

SELECT 'ACCESS TESTS:' as check_type;

-- Test 1: Check if artist emails are protected
SELECT 'Test 1: Artist emails protection' as test_name;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ ARTIST EMAILS PROTECTED - No email column visible in public view'
        ELSE '❌ ARTIST EMAILS EXPOSED'
    END as result
FROM information_schema.columns 
WHERE table_name = 'artists_public_safe' 
    AND column_name = 'email'
    AND table_schema = 'public';

-- Test 2: Check appointment data protection
SELECT 'Test 2: Appointment data protection' as test_name;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ APPOINTMENT DATA PROTECTED - No public SELECT access'
        ELSE '❌ APPOINTMENT DATA EXPOSED'
    END as result
FROM information_schema.table_privileges
WHERE table_name = 'appointments'
    AND privilege_type = 'SELECT'
    AND grantee IN ('PUBLIC', 'anon')
    AND table_schema = 'public';

-- Test 3: Check sales data protection (if table exists)
SELECT 'Test 3: Sales data protection' as test_name;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SALES DATA PROTECTED - No public access'
        ELSE '❌ SALES DATA EXPOSED'
    END as result
FROM information_schema.table_privileges tp
JOIN information_schema.tables t ON t.table_name = tp.table_name
WHERE tp.table_name = 'sales'
    AND tp.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    AND tp.grantee IN ('PUBLIC', 'anon', 'authenticated')
    AND tp.table_schema = 'public';

-- Test 4: Check client data protection
SELECT 'Test 4: Client data protection' as test_name;
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ CLIENT DATA PROTECTED - No public access'
        ELSE '❌ CLIENT DATA EXPOSED'
    END as result
FROM information_schema.table_privileges
WHERE table_name = 'clients'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    AND table_schema = 'public';

-- =============================================================================
-- 5. SUMMARY OF SECURE PUBLIC ACCESS
-- =============================================================================

SELECT 'APPROVED PUBLIC ACCESS:' as check_type;
SELECT 
    table_name,
    privilege_type,
    grantee,
    '✅ SAFE PUBLIC DATA' as status
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND grantee IN ('PUBLIC', 'anon', 'authenticated')
    AND table_name IN (
        'artists_public_safe',
        'collections_public_safe', 
        'artworks',
        'artwork_images',
        'collection_artworks',
        'exhibitions',
        'exhibition_artworks',
        'appointment_slots',
        'appointment_types',
        'booking_settings',
        'exchange_rates'
    )
ORDER BY table_name, privilege_type;

-- =============================================================================
-- 6. SECURITY POLICY COUNT
-- =============================================================================

SELECT 'RLS POLICY SUMMARY:' as check_type;
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ HAS POLICIES'
        ELSE '⚠️ NO POLICIES'
    END as status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

SELECT 'SECURITY VERIFICATION COMPLETE' as final_status;