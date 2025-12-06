-- =============================================================================
-- FIX 1: Drop overly permissive projects table policies
-- These policies use 'true' as qualifier, allowing any authenticated user access
-- =============================================================================

DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;

-- =============================================================================
-- FIX 2: Create SECURITY DEFINER function for workspace membership check
-- This avoids infinite recursion in RLS policies
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  )
$$;

-- =============================================================================
-- FIX 3: Fix workspace_members RLS policies to use the new function
-- =============================================================================

DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;

CREATE POLICY "Members can view workspace members" 
ON public.workspace_members
FOR SELECT 
USING (public.is_workspace_member(workspace_id) OR has_role(auth.uid(), 'gallery_admin'::user_role));