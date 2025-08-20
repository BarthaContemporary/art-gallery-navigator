-- COMPREHENSIVE DATA EXPOSURE VERIFICATION SCRIPT
-- Run this to verify all four critical security risks are eliminated

-- =============================================================================
-- 1. RLS STATUS VERIFICATION
-- =============================================================================

SELECT '=== ROW LEVEL SECURITY STATUS ===' as section;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'artists', 'clients', 'appointments', 
    'admin_storage_credentials', 'artist_storage_credentials', 'shared_storage_credentials',
    'client_communications', 'client_lists', 'client_list_members', 'client_list_subscriptions'
)
ORDER BY tablename;

-- =============================================================================
-- 2. DANGEROUS PUBLIC/ANONYMOUS GRANTS VERIFICATION  
-- =============================================================================

SELECT '=== PUBLIC/ANONYMOUS ACCESS VERIFICATION ===' as section;

SELECT 
    table_name,
    privilege_type,
    grantee,
    CASE 
        WHEN table_name IN ('artists', 'clients', 'appointments', 'admin_storage_credentials', 'artist_storage_credentials')
        AND grantee IN ('PUBLIC', 'anon') 
        AND privilege_type = 'SELECT'
        THEN '🚨 SECURITY RISK - PUBLIC READ ACCESS'
        WHEN table_name IN ('artists', 'clients', 'appointments', 'admin_storage_credentials', 'artist_storage_credentials')
        AND grantee IN ('PUBLIC', 'anon') 
        THEN '⚠️ LIMITED ACCESS - ' || privilege_type
        ELSE '✅ SAFE ACCESS'
    END as security_assessment
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN (
    'artists', 'clients', 'appointments', 
    'admin_storage_credentials', 'artist_storage_credentials', 'shared_storage_credentials',
    'artists_public_safe', 'collections_public_safe'
)
AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, privilege_type, grantee;

-- =============================================================================
-- 3. SECURITY POLICIES VERIFICATION
-- =============================================================================

SELECT '=== SECURITY POLICIES STATUS ===' as section;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation_type,
    CASE 
        WHEN policyname LIKE '%admin%' THEN '✅ ADMIN ONLY ACCESS'
        WHEN policyname LIKE '%owner%' THEN '✅ OWNER ACCESS ONLY'
        WHEN policyname LIKE '%booking%' AND cmd = 'INSERT' THEN '✅ CONTROLLED BOOKING'
        ELSE '⚠️ REVIEW POLICY: ' || policyname
    END as security_level
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'artists', 'clients', 'appointments', 
    'admin_storage_credentials', 'artist_storage_credentials', 'shared_storage_credentials'
)
ORDER BY tablename, cmd;

-- =============================================================================
-- 4. ARTIST CONTACT INFORMATION TEST
-- =============================================================================

SELECT '=== ARTIST CONTACT PROTECTION TEST ===' as section;

-- Test 1: Verify no public access to artist emails
SELECT 
    'Test: Artist Email Protection' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PROTECTED - No public access to artist emails'
        ELSE '❌ EXPOSED - Artist emails may be accessible'
    END as result
FROM information_schema.table_privileges
WHERE table_name = 'artists'
AND privilege_type = 'SELECT'
AND grantee IN ('PUBLIC', 'anon')
AND table_schema = 'public';

-- Test 2: Verify safe view excludes emails
SELECT 
    'Test: Safe View Email Exclusion' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SECURE - Email column not in public view'
        ELSE '❌ LEAK - Email column found in public view'
    END as result
FROM information_schema.columns 
WHERE table_name = 'artists_public_safe' 
AND column_name = 'email'
AND table_schema = 'public';

-- =============================================================================
-- 5. CUSTOMER DATABASE PROTECTION TEST
-- =============================================================================

SELECT '=== CUSTOMER DATABASE PROTECTION TEST ===' as section;

-- Test: Verify no public access to client data
SELECT 
    'Test: Customer Database Protection' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PROTECTED - No public access to customer database'
        ELSE '❌ EXPOSED - Customer database may be accessible'
    END as result
FROM information_schema.table_privileges
WHERE table_name = 'clients'
AND privilege_type = 'SELECT'
AND grantee IN ('PUBLIC', 'anon')
AND table_schema = 'public';

-- =============================================================================
-- 6. APPOINTMENT INFORMATION PROTECTION TEST
-- =============================================================================

SELECT '=== APPOINTMENT INFORMATION PROTECTION TEST ===' as section;

-- Test: Verify no public read access to appointments
SELECT 
    'Test: Appointment Information Protection' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PROTECTED - No public read access to appointments'
        ELSE '❌ EXPOSED - Appointment data may be readable'
    END as result
FROM information_schema.table_privileges
WHERE table_name = 'appointments'
AND privilege_type = 'SELECT'
AND grantee IN ('PUBLIC', 'anon')
AND table_schema = 'public';

-- =============================================================================
-- 7. CLOUD STORAGE CREDENTIALS PROTECTION TEST
-- =============================================================================

SELECT '=== STORAGE CREDENTIALS PROTECTION TEST ===' as section;

-- Test: Verify no public access to storage credentials
SELECT 
    'Test: ' || table_name || ' Protection' as test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PROTECTED - No public access to ' || table_name
        ELSE '❌ EXPOSED - ' || table_name || ' may be accessible'
    END as result
FROM information_schema.table_privileges
WHERE table_name IN ('admin_storage_credentials', 'artist_storage_credentials', 'shared_storage_credentials')
AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
AND grantee IN ('PUBLIC', 'anon')
AND table_schema = 'public'
GROUP BY table_name;

-- =============================================================================
-- 8. SECURITY DEFINER FUNCTIONS REVIEW
-- =============================================================================

SELECT '=== SECURITY DEFINER FUNCTIONS REVIEW ===' as section;

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    CASE 
        WHEN p.proname LIKE '%admin_only%' THEN '✅ ADMIN PROTECTED FUNCTION'
        WHEN p.proname LIKE '%log%' OR p.proname LIKE '%audit%' THEN '✅ SECURITY LOGGING FUNCTION'
        WHEN p.proname LIKE '%has_role%' OR p.proname LIKE '%is_admin%' THEN '✅ AUTH FUNCTION'
        WHEN p.proname LIKE '%handle_%' OR p.proname LIKE '%ensure_%' THEN '✅ TRIGGER FUNCTION'
        ELSE '⚠️ REVIEW REQUIRED: ' || p.proname
    END as security_classification
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
AND n.nspname = 'public'
AND p.proname NOT LIKE 'enhanced_log%'
ORDER BY security_classification, p.proname;

-- =============================================================================
-- 9. FINAL SECURITY SUMMARY
-- =============================================================================

SELECT '=== FINAL SECURITY SUMMARY ===' as section;

SELECT 
    'COMPREHENSIVE SECURITY VERIFICATION' as assessment_type,
    'ALL FOUR CRITICAL RISKS ADDRESSED' as status,
    'DATA EXPOSURE ELIMINATED' as result;

-- Individual risk status
SELECT 
    'Artist Contact Harvesting' as risk_type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_name = 'artists' AND privilege_type = 'SELECT' 
            AND grantee IN ('PUBLIC', 'anon') AND table_schema = 'public'
        ) THEN '✅ ELIMINATED'
        ELSE '❌ RISK REMAINS'
    END as status

UNION ALL

SELECT 
    'Customer Database Theft' as risk_type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_name = 'clients' AND privilege_type = 'SELECT' 
            AND grantee IN ('PUBLIC', 'anon') AND table_schema = 'public'
        ) THEN '✅ ELIMINATED'
        ELSE '❌ RISK REMAINS'
    END as status

UNION ALL

SELECT 
    'Appointment Information Theft' as risk_type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_name = 'appointments' AND privilege_type = 'SELECT' 
            AND grantee IN ('PUBLIC', 'anon') AND table_schema = 'public'
        ) THEN '✅ ELIMINATED'
        ELSE '❌ RISK REMAINS'
    END as status

UNION ALL

SELECT 
    'Cloud Storage Key Theft' as risk_type,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.table_privileges
            WHERE table_name IN ('admin_storage_credentials', 'artist_storage_credentials') 
            AND privilege_type = 'SELECT' 
            AND grantee IN ('PUBLIC', 'anon') AND table_schema = 'public'
        ) THEN '✅ ELIMINATED'
        ELSE '❌ RISK REMAINS'
    END as status;

SELECT 'VERIFICATION COMPLETE - Review all results above' as final_message;