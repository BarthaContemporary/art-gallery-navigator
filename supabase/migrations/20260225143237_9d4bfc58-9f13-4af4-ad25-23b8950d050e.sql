
-- Table to store 3D reconstruction results for tour nodes
CREATE TABLE public.tour_3d_reconstructions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id UUID NOT NULL REFERENCES public.tour_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  camera_poses JSONB, -- Array of {image_id, x, y, z, yaw, pitch, roll, fov}
  scene_config JSONB, -- Scene-level config (bounds, center, scale)
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(node_id)
);

ALTER TABLE public.tour_3d_reconstructions ENABLE ROW LEVEL SECURITY;

-- Allow read access for anyone who can access the tour project
CREATE POLICY "Users can view 3D reconstructions for accessible projects"
ON public.tour_3d_reconstructions FOR SELECT
USING (
  public.can_access_tour_node(node_id)
);

-- Allow insert/update for project owners
CREATE POLICY "Project owners can manage 3D reconstructions"
ON public.tour_3d_reconstructions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tour_nodes tn
    JOIN public.tour_projects tp ON tn.project_id = tp.id
    WHERE tn.id = node_id AND tp.owner_id = auth.uid()
  )
);

CREATE POLICY "Project owners can update 3D reconstructions"
ON public.tour_3d_reconstructions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.tour_nodes tn
    JOIN public.tour_projects tp ON tn.project_id = tp.id
    WHERE tn.id = node_id AND tp.owner_id = auth.uid()
  )
);

CREATE POLICY "Project owners can delete 3D reconstructions"
ON public.tour_3d_reconstructions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tour_nodes tn
    JOIN public.tour_projects tp ON tn.project_id = tp.id
    WHERE tn.id = node_id AND tp.owner_id = auth.uid()
  )
);

CREATE TRIGGER update_tour_3d_reconstructions_updated_at
BEFORE UPDATE ON public.tour_3d_reconstructions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
