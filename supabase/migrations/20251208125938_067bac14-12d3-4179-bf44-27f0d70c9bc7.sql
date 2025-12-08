-- CRITICAL FIX: Remove public access to collection_websites raw table
-- Password hashes should NEVER be publicly accessible

-- Drop the overly permissive public policy that exposes password_hash
DROP POLICY IF EXISTS "Public can view active collection websites" ON public.collection_websites;

-- Recreate the collection_websites_public_safe view with security_invoker
DROP VIEW IF EXISTS public.collection_websites_public_safe;

CREATE VIEW public.collection_websites_public_safe 
WITH (security_invoker = true)
AS SELECT 
    id,
    collection_id,
    slug,
    name,
    show_prices,
    is_active,
    created_at,
    updated_at,
    (password_hash IS NOT NULL) AS requires_password
FROM public.collection_websites
WHERE is_active = true;

-- Grant access to the safe view (not the raw table)
GRANT SELECT ON public.collection_websites_public_safe TO anon;
GRANT SELECT ON public.collection_websites_public_safe TO authenticated;

-- Add comment explaining the security design
COMMENT ON VIEW public.collection_websites_public_safe IS 
'Public-safe view of collection websites. Excludes password_hash and only shows active websites. 
Password verification must go through verify-collection-password edge function.';

-- Ensure the raw table only allows admin access
-- The existing "Admins can manage collection websites" policy remains for admin CRUD