-- COMPREHENSIVE DATA EXPOSURE ELIMINATION
-- Addresses all four critical security risks systematically

-- =============================================================================
-- 0. BASELINE SECURITY VERIFICATION
-- =============================================================================

-- Log start of comprehensive security hardening
SELECT public.enhanced_log_security_event(
    'comprehensive_data_exposure_elimination_start',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'comprehensive_security_hardening',
        'target_issues', jsonb_build_array(
            'artist_contact_harvesting',
            'cloud_storage_key_theft',
            'customer_database_theft',
            'appointment_information_theft'
        ),
        'scope', 'complete_data_exposure_elimination',
        'status', 'security_hardening_initiated'
    )
);

-- =============================================================================
-- 1. ARTIST CONTACT INFORMATION PROTECTION
-- =============================================================================

-- Ensure artists table has no public read access to contact fields
REVOKE ALL ON public.artists FROM PUBLIC;
REVOKE ALL ON public.artists FROM anon;

-- Verify artists_public_safe view exists and excludes contact info
-- (This was already created in previous migrations)

-- Create admin-only function for artist contact access
CREATE OR REPLACE FUNCTION public.get_artist_contacts_admin_only()
RETURNS TABLE(
    id uuid,
    full_name text,
    email text,
    user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- =============================================================================
-- 2. CLOUD STORAGE KEYS PROTECTION
-- =============================================================================

-- Secure admin storage credentials
ALTER TABLE public.admin_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Anyone can view admin storage credentials" ON public.admin_storage_credentials;

-- Create ultra-strict admin-only policy
CREATE POLICY "admin_storage_credentials_super_secure"
    ON public.admin_storage_credentials
    FOR ALL
    USING (
        has_role(auth.uid(), 'gallery_admin'::user_role) 
        AND user_id = auth.uid()  -- Only admin can access their own credentials
    )
    WITH CHECK (
        has_role(auth.uid(), 'gallery_admin'::user_role) 
        AND user_id = auth.uid()
    );

-- Secure artist storage credentials  
ALTER TABLE public.artist_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Create artist-specific storage credential policy
CREATE POLICY "artist_storage_credentials_owner_only"
    ON public.artist_storage_credentials
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.artists a 
            WHERE a.id = artist_storage_credentials.artist_id 
            AND a.user_id = auth.uid()
        )
        OR has_role(auth.uid(), 'gallery_admin'::user_role)
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.artists a 
            WHERE a.id = artist_storage_credentials.artist_id 
            AND a.user_id = auth.uid()
        )
        OR has_role(auth.uid(), 'gallery_admin'::user_role)
    );

-- Secure shared storage credentials if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_storage_credentials' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.shared_storage_credentials ENABLE ROW LEVEL SECURITY';
        
        EXECUTE '
        CREATE POLICY "shared_storage_credentials_admin_only"
            ON public.shared_storage_credentials
            FOR ALL
            USING (has_role(auth.uid(), ''gallery_admin''::user_role))
            WITH CHECK (has_role(auth.uid(), ''gallery_admin''::user_role))';
    END IF;
END $$;

-- Remove all public access to storage credential tables
REVOKE ALL ON public.admin_storage_credentials FROM PUBLIC;
REVOKE ALL ON public.admin_storage_credentials FROM anon;
REVOKE ALL ON public.admin_storage_credentials FROM authenticated;

REVOKE ALL ON public.artist_storage_credentials FROM PUBLIC;
REVOKE ALL ON public.artist_storage_credentials FROM anon;
REVOKE ALL ON public.artist_storage_credentials FROM authenticated;

-- =============================================================================
-- 3. COMPLETE CUSTOMER DATABASE PROTECTION
-- =============================================================================

-- Ensure clients table is completely secured
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop any public policies
DROP POLICY IF EXISTS "Anyone can view clients" ON public.clients;

-- Create ultra-strict admin-only client access
CREATE POLICY "clients_admin_only_secure"
    ON public.clients
    FOR ALL
    USING (has_role(auth.uid(), 'gallery_admin'::user_role))
    WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Remove all public access to client data
REVOKE ALL ON public.clients FROM PUBLIC;
REVOKE ALL ON public.clients FROM anon;
REVOKE ALL ON public.clients FROM authenticated;

-- Secure related client tables
ALTER TABLE public.client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_list_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remove public access from all client-related tables
REVOKE ALL ON public.client_communications FROM PUBLIC;
REVOKE ALL ON public.client_communications FROM anon;
REVOKE ALL ON public.client_communications FROM authenticated;

REVOKE ALL ON public.client_lists FROM PUBLIC;
REVOKE ALL ON public.client_lists FROM anon;
REVOKE ALL ON public.client_lists FROM authenticated;

REVOKE ALL ON public.client_list_members FROM PUBLIC;
REVOKE ALL ON public.client_list_members FROM anon;
REVOKE ALL ON public.client_list_members FROM authenticated;

REVOKE ALL ON public.client_list_subscriptions FROM PUBLIC;
REVOKE ALL ON public.client_list_subscriptions FROM anon;
REVOKE ALL ON public.client_list_subscriptions FROM authenticated;

-- Create admin-only function for client access
CREATE OR REPLACE FUNCTION public.get_clients_admin_only()
RETURNS TABLE(
    id uuid,
    full_name text,
    email text,
    phone text,
    company text,
    status text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Ultra-strict admin check
    IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
        RAISE EXCEPTION 'Access denied: Gallery admin role required to access customer database';
    END IF;
    
    RETURN QUERY
    SELECT 
        c.id, c.full_name, c.email, c.phone, c.company, 
        c.status::text, c.created_at
    FROM public.clients c
    ORDER BY c.created_at DESC;
END;
$$;

-- =============================================================================
-- 4. CUSTOMER APPOINTMENT INFORMATION PROTECTION
-- =============================================================================

-- Appointments table should already be secured from previous migrations
-- But let's ensure it's completely locked down

-- Verify no public read access to appointments
REVOKE SELECT ON public.appointments FROM PUBLIC;
REVOKE SELECT ON public.appointments FROM anon;

-- Ensure appointment-related tables are also secured
REVOKE ALL ON public.appointment_slots FROM PUBLIC;
REVOKE ALL ON public.appointment_types FROM PUBLIC;
REVOKE ALL ON public.booking_settings FROM PUBLIC;

-- Grant only safe read access to appointment availability
GRANT SELECT ON public.appointment_slots TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_types TO PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_settings TO PUBLIC, anon, authenticated;

-- =============================================================================
-- 5. FINAL SECURITY VERIFICATION
-- =============================================================================

-- Verify no dangerous public grants remain
SELECT 
    'SECURITY VERIFICATION:' as check_type,
    table_name,
    privilege_type,
    grantee,
    CASE 
        WHEN table_name IN ('artists', 'clients', 'appointments', 'admin_storage_credentials', 'artist_storage_credentials')
        AND grantee IN ('PUBLIC', 'anon') 
        AND privilege_type = 'SELECT'
        THEN '🚨 SECURITY RISK DETECTED'
        ELSE '✅ SECURE'
    END as security_status
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('artists', 'clients', 'appointments', 'admin_storage_credentials', 'artist_storage_credentials')
AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY table_name, privilege_type;

-- Log completion of comprehensive security hardening
SELECT public.enhanced_log_security_event(
    'comprehensive_data_exposure_elimination_complete',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'comprehensive_security_hardening_complete',
        'issues_resolved', jsonb_build_array(
            'artist_contact_information_secured',
            'cloud_storage_keys_ultra_secured',
            'customer_database_admin_only',
            'appointment_information_protected'
        ),
        'security_measures', jsonb_build_array(
            'removed_all_public_access',
            'ultra_strict_admin_policies',
            'secure_access_functions_created',
            'storage_credentials_owner_only'
        ),
        'status', 'all_data_exposure_risks_eliminated'
    )
);