
-- =====================================================
-- PhotoTour Studio — Core Database Schema (Fixed order)
-- =====================================================

-- Enum types (may already exist from failed run, use IF NOT EXISTS)
DO $$ BEGIN CREATE TYPE public.tour_visibility AS ENUM ('private', 'unlisted', 'public'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tour_node_type AS ENUM ('panorama', 'image_set'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tour_job_status AS ENUM ('queued', 'processing', 'done', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tour_job_type AS ENUM ('thumbnail', 'responsive', 'tile_pyramid', 'panorama_stitch'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tour_collaborator_role AS ENUM ('editor', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Tour Projects (no collaborator policy yet)
CREATE TABLE IF NOT EXISTS public.tour_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  location TEXT,
  visibility public.tour_visibility NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_projects_owner ON public.tour_projects(owner_id);
ALTER TABLE public.tour_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their projects"
  ON public.tour_projects FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Public projects are viewable by anyone"
  ON public.tour_projects FOR SELECT
  USING (visibility = 'public');

-- 2. Tour Collaborators
CREATE TABLE IF NOT EXISTS public.tour_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tour_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tour_collaborator_role NOT NULL DEFAULT 'viewer',
  invited_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tour_collaborators_project ON public.tour_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_tour_collaborators_user ON public.tour_collaborators(user_id);
ALTER TABLE public.tour_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can manage collaborators"
  ON public.tour_collaborators FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tour_projects tp WHERE tp.id = tour_collaborators.project_id AND tp.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tour_projects tp WHERE tp.id = tour_collaborators.project_id AND tp.owner_id = auth.uid()));

CREATE POLICY "Users can view their own collaborations"
  ON public.tour_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- Now add collaborator policy to tour_projects
CREATE POLICY "Collaborators can view projects"
  ON public.tour_projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tour_collaborators tc WHERE tc.project_id = tour_projects.id AND tc.user_id = auth.uid()));

-- 3. Tour Floorplans
CREATE TABLE IF NOT EXISTS public.tour_floorplans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tour_projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  label TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_floorplans_project ON public.tour_floorplans(project_id);
ALTER TABLE public.tour_floorplans ENABLE ROW LEVEL SECURITY;

-- Helper function for project access
CREATE OR REPLACE FUNCTION public.can_access_tour_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_projects tp
    WHERE tp.id = _project_id
    AND (
      tp.owner_id = auth.uid()
      OR tp.visibility = 'public'
      OR EXISTS (SELECT 1 FROM public.tour_collaborators tc WHERE tc.project_id = tp.id AND tc.user_id = auth.uid())
    )
  )
$$;

CREATE POLICY "Project access for floorplans"
  ON public.tour_floorplans FOR ALL
  USING (public.can_access_tour_project(project_id));

-- 4. Tour Nodes
CREATE TABLE IF NOT EXISTS public.tour_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tour_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  node_type public.tour_node_type NOT NULL DEFAULT 'image_set',
  position_index INTEGER NOT NULL DEFAULT 0,
  floorplan_id UUID REFERENCES public.tour_floorplans(id) ON DELETE SET NULL,
  floorplan_x REAL,
  floorplan_y REAL,
  initial_heading REAL DEFAULT 0,
  panorama_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_nodes_project ON public.tour_nodes(project_id);
ALTER TABLE public.tour_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project access for nodes"
  ON public.tour_nodes FOR ALL
  USING (public.can_access_tour_project(project_id));

-- 5. Tour Node Images
CREATE TABLE IF NOT EXISTS public.tour_node_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.tour_nodes(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  thumbnail_url TEXT,
  medium_url TEXT,
  large_url TEXT,
  tile_base_url TEXT,
  original_width INTEGER,
  original_height INTEGER,
  file_size BIGINT,
  mime_type TEXT,
  exif_data JSONB,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  processing_status public.tour_job_status DEFAULT 'queued',
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_node_images_node ON public.tour_node_images(node_id);
ALTER TABLE public.tour_node_images ENABLE ROW LEVEL SECURITY;

-- Helper: check node project access
CREATE OR REPLACE FUNCTION public.can_access_tour_node(_node_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_nodes tn
    WHERE tn.id = _node_id
    AND public.can_access_tour_project(tn.project_id)
  )
$$;

CREATE POLICY "Project access for node images"
  ON public.tour_node_images FOR ALL
  USING (public.can_access_tour_node(node_id));

-- 6. Tour Hotspots
CREATE TABLE IF NOT EXISTS public.tour_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID NOT NULL REFERENCES public.tour_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES public.tour_nodes(id) ON DELETE SET NULL,
  label TEXT,
  icon TEXT DEFAULT 'arrow',
  yaw REAL,
  pitch REAL,
  coord_x REAL,
  coord_y REAL,
  info_title TEXT,
  info_content TEXT,
  info_media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_hotspots_source ON public.tour_hotspots(source_node_id);
ALTER TABLE public.tour_hotspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project access for hotspots"
  ON public.tour_hotspots FOR ALL
  USING (public.can_access_tour_node(source_node_id));

-- 7. Tour Share Links
CREATE TABLE IF NOT EXISTS public.tour_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.tour_projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_share_links_project ON public.tour_share_links(project_id);
ALTER TABLE public.tour_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can manage share links"
  ON public.tour_share_links FOR ALL
  USING (EXISTS (SELECT 1 FROM public.tour_projects tp WHERE tp.id = tour_share_links.project_id AND tp.owner_id = auth.uid()));

CREATE POLICY "Anyone can read active share links"
  ON public.tour_share_links FOR SELECT
  USING (is_active = true);

-- 8. Tour Processing Jobs
CREATE TABLE IF NOT EXISTS public.tour_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_image_id UUID REFERENCES public.tour_node_images(id) ON DELETE CASCADE,
  node_id UUID REFERENCES public.tour_nodes(id) ON DELETE CASCADE,
  job_type public.tour_job_type NOT NULL,
  status public.tour_job_status NOT NULL DEFAULT 'queued',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  result_data JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tour_jobs_status ON public.tour_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tour_jobs_image ON public.tour_processing_jobs(node_image_id);
ALTER TABLE public.tour_processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view processing jobs"
  ON public.tour_processing_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tour_node_images tni
      JOIN public.tour_nodes tn ON tn.id = tni.node_id
      JOIN public.tour_projects tp ON tp.id = tn.project_id
      WHERE tni.id = tour_processing_jobs.node_image_id
      AND tp.owner_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_tour_projects_updated_at BEFORE UPDATE ON public.tour_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tour_floorplans_updated_at BEFORE UPDATE ON public.tour_floorplans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tour_nodes_updated_at BEFORE UPDATE ON public.tour_nodes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tour_node_images_updated_at BEFORE UPDATE ON public.tour_node_images FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tour_hotspots_updated_at BEFORE UPDATE ON public.tour_hotspots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tour_processing_jobs_updated_at BEFORE UPDATE ON public.tour_processing_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tour-uploads', 'tour-uploads', true, 104857600)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload tour files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tour-uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Tour files are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tour-uploads');

CREATE POLICY "Users can update their own tour files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tour-uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own tour files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'tour-uploads' AND auth.role() = 'authenticated');
