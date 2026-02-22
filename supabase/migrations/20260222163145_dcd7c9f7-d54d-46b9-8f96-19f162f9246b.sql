
-- Fix infinite recursion between tour_projects and tour_collaborators

-- Drop the recursive policies
DROP POLICY IF EXISTS "Collaborators can view projects" ON public.tour_projects;
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.tour_collaborators;

-- Create a SECURITY DEFINER function to check project ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_tour_project_owner(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_projects
    WHERE id = _project_id AND owner_id = auth.uid()
  );
$$;

-- Create a SECURITY DEFINER function to check if user is a collaborator
CREATE OR REPLACE FUNCTION public.is_tour_collaborator(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_collaborators
    WHERE project_id = _project_id AND user_id = auth.uid()
  );
$$;

-- Re-create tour_projects policy using SECURITY DEFINER function
CREATE POLICY "Collaborators can view projects"
ON public.tour_projects
FOR SELECT
USING (public.is_tour_collaborator(id));

-- Re-create tour_collaborators policy using SECURITY DEFINER function
CREATE POLICY "Project owners can manage collaborators"
ON public.tour_collaborators
FOR ALL
USING (public.is_tour_project_owner(project_id))
WITH CHECK (public.is_tour_project_owner(project_id));
