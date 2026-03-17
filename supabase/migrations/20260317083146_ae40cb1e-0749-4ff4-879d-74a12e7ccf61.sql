
-- ===========================================
-- FIX 1: project_users privilege escalation
-- Remove permissive INSERT and ALL policies that allow any user to join any project
-- ===========================================

-- Drop the dangerous permissive INSERT policy
DROP POLICY IF EXISTS "Users can add themselves to projects" ON public.project_users;

-- Drop the dangerous ALL policy that gives full CRUD to any user on their rows
DROP POLICY IF EXISTS "Users can access their projects" ON public.project_users;

-- Drop the ineffective blocking policy (was overridden by permissive policies)
DROP POLICY IF EXISTS "Block direct inserts into project_users" ON public.project_users;

-- Drop redundant/overlapping policies to clean up
DROP POLICY IF EXISTS "Admins can access all project_users" ON public.project_users;
DROP POLICY IF EXISTS "Admins can delete project user associations" ON public.project_users;
DROP POLICY IF EXISTS "Admins can manage all project members" ON public.project_users;
DROP POLICY IF EXISTS "Admins can manage all project users" ON public.project_users;
DROP POLICY IF EXISTS "Admins can manage project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Admins can view project user associations" ON public.project_users;
DROP POLICY IF EXISTS "Admins have full access to project users" ON public.project_users;
DROP POLICY IF EXISTS "Secure project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Users can remove themselves from projects" ON public.project_users;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.project_users;
DROP POLICY IF EXISTS "Users can view their own project memberships" ON public.project_users;
DROP POLICY IF EXISTS "Users can view their project assignments" ON public.project_users;
DROP POLICY IF EXISTS "project_users_delete_policy" ON public.project_users;
DROP POLICY IF EXISTS "project_users_select_policy" ON public.project_users;

-- Create clean, minimal policies

-- SELECT: Users can see their own memberships
CREATE POLICY "project_users_select_own"
ON public.project_users FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- SELECT: Admins can see all memberships
CREATE POLICY "project_users_select_admin"
ON public.project_users FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- INSERT: Only admins can add users to projects
CREATE POLICY "project_users_insert_admin_only"
ON public.project_users FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- UPDATE: Only admins can update memberships
CREATE POLICY "project_users_update_admin_only"
ON public.project_users FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- DELETE: Admins can remove anyone; users can remove themselves
CREATE POLICY "project_users_delete"
ON public.project_users FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'gallery_admin'::user_role));

-- ===========================================
-- FIX 2: tour_share_links password hash exposure
-- Create a safe view and restrict the public SELECT policy
-- ===========================================

-- Drop the dangerous public SELECT policy that exposes password_hash
DROP POLICY IF EXISTS "Anyone can read active share links" ON public.tour_share_links;

-- Create a safe view that excludes password_hash
CREATE OR REPLACE VIEW public.tour_share_links_public_safe
WITH (security_barrier = true) AS
SELECT id, project_id, slug, expires_at, is_active, view_count, created_by, created_at
FROM public.tour_share_links
WHERE is_active = true;

-- Grant SELECT on the safe view to anon and authenticated roles
GRANT SELECT ON public.tour_share_links_public_safe TO anon;
GRANT SELECT ON public.tour_share_links_public_safe TO authenticated;

-- Create a SECURITY DEFINER function to verify tour share link passwords server-side
CREATE OR REPLACE FUNCTION public.verify_tour_share_link_password(
  _slug text,
  _password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.tour_share_links
  WHERE slug = _slug AND is_active = true;
  
  IF stored_hash IS NULL THEN
    -- No password set, link is public
    RETURN true;
  END IF;
  
  -- Compare using crypt if hash is bcrypt, otherwise direct comparison
  IF stored_hash LIKE '$2%' THEN
    RETURN stored_hash = crypt(_password, stored_hash);
  ELSE
    RETURN stored_hash = _password;
  END IF;
END;
$$;

-- Authenticated users who own the project can still see the full row (including password_hash)
-- via the existing "Project owners can manage share links" ALL policy
-- For public/anonymous access, they should use the safe view instead

-- Add a restricted SELECT policy for authenticated users (non-owners can read active links without password_hash via the view)
CREATE POLICY "Authenticated users can read active share links"
ON public.tour_share_links FOR SELECT
TO authenticated
USING (is_active = true);
