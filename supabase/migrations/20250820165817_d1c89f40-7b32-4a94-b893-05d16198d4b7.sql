-- COMPREHENSIVE APPOINTMENTS SECURITY AUDIT AND FIX
-- Ensure appointments table is completely secure from public access

-- =============================================================================
-- 1. VERIFY AND CLEAN UP POLICIES
-- =============================================================================

-- Drop duplicate/redundant policies (keeping the most restrictive ones)
DROP POLICY IF EXISTS "Only admins can manage appointments" ON public.appointments;

-- Ensure we have clean, secure policies
DROP POLICY IF EXISTS "Secure appointment creation for booking" ON public.appointments;

-- Create a single, secure admin policy
CREATE POLICY "appointments_admin_full_access"
    ON public.appointments
    FOR ALL
    USING (has_role(auth.uid(), 'gallery_admin'::user_role))
    WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create a secure booking policy for appointment creation only
CREATE POLICY "appointments_secure_booking_creation"
    ON public.appointments
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        -- Strict validation for booking
        client_name IS NOT NULL 
        AND client_email IS NOT NULL
        AND start_datetime IS NOT NULL
        AND end_datetime IS NOT NULL
        AND start_datetime > NOW()  -- Future appointments only
        AND end_datetime > start_datetime  -- End after start
        -- No read access through this policy
    );

-- =============================================================================
-- 2. REMOVE ANY REMAINING PUBLIC ACCESS
-- =============================================================================

-- Ensure no public grants exist
REVOKE ALL ON public.appointments FROM PUBLIC;
REVOKE ALL ON public.appointments FROM anon;

-- Grant only specific, controlled access
GRANT INSERT ON public.appointments TO anon, authenticated;  -- For booking only

-- =============================================================================
-- 3. VERIFY APPOINTMENTS TABLE SECURITY
-- =============================================================================

-- Check final policy status
SELECT 
    'Final Policy Check:' as status,
    policyname,
    cmd as command,
    CASE 
        WHEN cmd = 'ALL' AND policyname LIKE '%admin%' THEN '✅ ADMIN ONLY ACCESS'
        WHEN cmd = 'INSERT' AND policyname LIKE '%booking%' THEN '✅ CONTROLLED BOOKING'
        ELSE '⚠️ ' || cmd || ' - ' || policyname
    END as security_status
FROM pg_policies
WHERE tablename = 'appointments' AND schemaname = 'public'
ORDER BY cmd;

-- =============================================================================
-- 4. CREATE SECURE APPOINTMENT ACCESS FUNCTIONS
-- =============================================================================

-- Create admin-only function to view appointments (instead of direct table access)
CREATE OR REPLACE FUNCTION public.get_appointments_for_admin()
RETURNS TABLE(
    id uuid,
    client_name text,
    client_email text,
    client_phone text,
    start_datetime timestamp with time zone,
    end_datetime timestamp with time zone,
    status text,
    notes text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Needs SECURITY DEFINER to access appointments
SET search_path TO 'public'
AS $$
BEGIN
    -- Only admins can access this function
    IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;
    
    RETURN QUERY
    SELECT 
        a.id,
        a.client_name,
        a.client_email,
        a.client_phone,
        a.start_datetime,
        a.end_datetime,
        a.status::text,
        a.notes,
        a.created_at
    FROM public.appointments a
    ORDER BY a.start_datetime DESC;
END;
$$;

-- Create public function for available appointment slots (no sensitive data)
CREATE OR REPLACE FUNCTION public.get_available_appointment_slots()
RETURNS TABLE(
    slot_id uuid,
    date date,
    start_time time,
    end_time time,
    appointment_type text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
    SELECT 
        s.id,
        s.date,
        s.start_time,
        s.end_time,
        t.name as appointment_type
    FROM public.appointment_slots s
    LEFT JOIN public.appointment_types t ON s.appointment_type_id = t.id
    WHERE s.is_available = true
    AND (s.date IS NULL OR s.date >= CURRENT_DATE)
    ORDER BY s.date, s.start_time;
$$;

-- =============================================================================
-- 5. LOG SECURITY ENHANCEMENT
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'appointments_security_hardened',
    'critical',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'comprehensive_appointments_security_audit',
        'security_measures', jsonb_build_array(
            'cleaned_duplicate_policies',
            'admin_only_full_access_policy',
            'controlled_booking_insert_only',
            'removed_all_public_grants',
            'created_secure_admin_functions',
            'created_safe_public_functions'
        ),
        'customer_data_protection', 'fully_secured',
        'public_access_removed', true,
        'admin_function_created', 'get_appointments_for_admin',
        'status', 'appointments_customer_data_completely_secured'
    )
);