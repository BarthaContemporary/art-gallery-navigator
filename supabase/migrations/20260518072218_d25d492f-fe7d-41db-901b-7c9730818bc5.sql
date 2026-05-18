
-- 1. crm_deal_items: restrict SELECT to gallery admins
DROP POLICY IF EXISTS "Authenticated users can view deal items" ON public.crm_deal_items;

-- 2. tour_share_links: restrict SELECT to project owners only
DROP POLICY IF EXISTS "Authenticated users can read active share links" ON public.tour_share_links;

CREATE POLICY "Project owners can read share links"
ON public.tour_share_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tour_projects tp
    WHERE tp.id = tour_share_links.project_id
      AND tp.owner_id = auth.uid()
  )
);

-- 3. tour_annotations: enforce visible_to at DB level
DROP POLICY IF EXISTS "Public can read annotations on accessible projects" ON public.tour_annotations;

CREATE POLICY "Public can read annotations on accessible projects"
ON public.tour_annotations
FOR SELECT
USING (
  public.can_access_tour_project(project_id)
  AND (
    visible_to = 'public'
    OR auth.uid() IS NOT NULL
  )
);
