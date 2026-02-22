
-- Annotation pins for Inspection Mode on tour node images
CREATE TABLE public.tour_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_image_id UUID REFERENCES public.tour_node_images(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.tour_projects(id) ON DELETE CASCADE NOT NULL,
  -- Position: normalized 0-1 for image-set, yaw/pitch for panorama
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Content
  label TEXT NOT NULL DEFAULT '',
  annotation_type TEXT NOT NULL DEFAULT 'info', -- info, material, dimension, price
  content JSONB DEFAULT '{}', -- { material: "Oil on canvas", dimensions: "120x80cm", price_on_request: true, notes: "..." }
  -- Visibility
  visible_to TEXT NOT NULL DEFAULT 'authenticated', -- authenticated, password, public
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.tour_annotations ENABLE ROW LEVEL SECURITY;

-- Owner/collaborator can manage annotations
CREATE POLICY "Owners can manage annotations"
ON public.tour_annotations FOR ALL
USING (public.can_access_tour_project(project_id))
WITH CHECK (public.can_access_tour_project(project_id));

-- Public can read annotations on public/unlisted projects (viewer checks visible_to in app code)
CREATE POLICY "Public can read annotations on accessible projects"
ON public.tour_annotations FOR SELECT
USING (public.can_access_tour_project(project_id));

CREATE INDEX idx_tour_annotations_node_image ON public.tour_annotations(node_image_id);
CREATE INDEX idx_tour_annotations_project ON public.tour_annotations(project_id);

CREATE TRIGGER update_tour_annotations_updated_at
BEFORE UPDATE ON public.tour_annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
