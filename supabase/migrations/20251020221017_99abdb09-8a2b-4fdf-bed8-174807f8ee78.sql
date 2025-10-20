-- ============================================
-- Fix: Business Addresses and Storage Locations Exposed
-- Restrict locations table to admin-only access
-- Create public-safe view for booking functionality
-- ============================================

-- Step 1: Drop the overly permissive RLS policy
DROP POLICY IF EXISTS "Authenticated users can view all locations" ON public.locations;

-- Step 2: Create admin-only access policy for the locations table
CREATE POLICY "Only admins can view all locations"
ON public.locations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Step 3: Create a public-safe view for booking pages
-- This exposes only id, name, and type (no addresses or notes)
CREATE OR REPLACE VIEW public.locations_booking_safe AS
SELECT 
  id,
  name,
  type
FROM public.locations
WHERE type IN ('gallery', 'showroom', 'viewing_room');

-- Step 4: Grant access to the safe view for authenticated users
GRANT SELECT ON public.locations_booking_safe TO authenticated;
GRANT SELECT ON public.locations_booking_safe TO anon;

-- Step 5: Add comment explaining the security rationale
COMMENT ON VIEW public.locations_booking_safe IS 
'Public-safe view of locations for booking functionality. Excludes sensitive business addresses and storage facility details. Only exposes public-facing locations (galleries, showrooms, viewing rooms).';