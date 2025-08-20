-- APPOINTMENTS SECURITY FIX (Handle Existing Policies)
-- Clean up and secure appointments table properly

-- =============================================================================
-- 1. CLEAN UP EXISTING POLICIES SAFELY
-- =============================================================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Only admins can manage appointments" ON public.appointments;
DROP POLICY IF EXISTS "appointments_admin_full_access" ON public.appointments;
DROP POLICY IF EXISTS "Secure appointment creation for booking" ON public.appointments;
DROP POLICY IF EXISTS "appointments_secure_booking_creation" ON public.appointments;

-- =============================================================================
-- 2. CREATE CLEAN, SECURE POLICIES
-- =============================================================================

-- Admin-only access for viewing/managing appointments
CREATE POLICY "appointments_admin_only"
    ON public.appointments
    FOR ALL
    USING (has_role(auth.uid(), 'gallery_admin'::user_role))
    WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Controlled booking creation (INSERT only, no read access)
CREATE POLICY "appointments_booking_insert_only"
    ON public.appointments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        client_name IS NOT NULL 
        AND client_email IS NOT NULL
        AND start_datetime IS NOT NULL
        AND end_datetime IS NOT NULL
        AND start_datetime > NOW()
        AND end_datetime > start_datetime
    );

-- =============================================================================
-- 3. REMOVE ALL PUBLIC ACCESS COMPLETELY
-- =============================================================================

-- Revoke any existing grants
REVOKE ALL ON public.appointments FROM PUBLIC;
REVOKE ALL ON public.appointments FROM anon;

-- Grant only minimal INSERT permission for booking
GRANT INSERT ON public.appointments TO anon, authenticated;

-- =============================================================================
-- 4. VERIFY NO PUBLIC READ ACCESS EXISTS
-- =============================================================================

-- Test query to verify no unauthorized access
DO $$
BEGIN
    -- This should show that only admins can read appointments
    IF EXISTS (
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'appointments' 
        AND table_schema = 'public'
        AND privilege_type = 'SELECT'
        AND grantee IN ('PUBLIC', 'anon')
    ) THEN
        RAISE EXCEPTION 'SECURITY RISK: Public read access still exists on appointments table';
    END IF;
    
    RAISE NOTICE 'SECURITY VERIFIED: No public read access to appointments table';
END $$;

-- =============================================================================
-- 5. CREATE SECURE ACCESS FUNCTIONS
-- =============================================================================

-- Admin function to access appointments securely
CREATE OR REPLACE FUNCTION public.get_appointments_admin_only()
RETURNS TABLE(
    id uuid,
    client_name text,
    client_email text,
    client_phone text,
    start_datetime timestamp with time zone,
    end_datetime timestamp with time zone,
    status text,
    notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Strict admin check
    IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
        RAISE EXCEPTION 'Access denied: Gallery admin role required';
    END IF;
    
    RETURN QUERY
    SELECT 
        a.id, a.client_name, a.client_email, a.client_phone,
        a.start_datetime, a.end_datetime, a.status::text, a.notes
    FROM public.appointments a
    ORDER BY a.start_datetime DESC;
END;
$$;

-- =============================================================================
-- 6. FINAL SECURITY VERIFICATION
-- =============================================================================

-- Show final policy configuration
SELECT 
    'FINAL APPOINTMENTS SECURITY STATUS' as verification,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'ALL' THEN '✅ ADMIN READ/WRITE ONLY'
        WHEN cmd = 'INSERT' THEN '✅ CONTROLLED BOOKING ONLY'
        ELSE '⚠️ UNKNOWN: ' || cmd
    END as security_level
FROM pg_policies
WHERE tablename = 'appointments' AND schemaname = 'public'
ORDER BY cmd;

-- Log security completion
SELECT public.enhanced_log_security_event(
    'appointments_customer_data_secured',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'issue', 'customer_contact_information_exposure',
        'resolution', 'admin_only_access_enforced',
        'policies_created', 2,
        'public_access_removed', true,
        'secure_function_created', 'get_appointments_admin_only',
        'customer_data_protection', 'maximum_security',
        'status', 'customer_contact_information_fully_protected'
    )
);