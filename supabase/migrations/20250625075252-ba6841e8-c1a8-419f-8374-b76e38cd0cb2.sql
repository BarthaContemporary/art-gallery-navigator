
-- Create folders table for hierarchical organization
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  path text GENERATED ALWAYS AS (
    CASE 
      WHEN parent_folder_id IS NULL THEN '/' || name
      ELSE NULL -- Will be updated by trigger for nested paths
    END
  ) STORED
);

-- Create shared_links table for public file sharing
CREATE TABLE public.shared_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),
  file_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  expires_at timestamp with time zone,
  password_hash text,
  permissions text NOT NULL DEFAULT 'view' CHECK (permissions IN ('view', 'download', 'edit')),
  is_active boolean NOT NULL DEFAULT true,
  download_count integer NOT NULL DEFAULT 0,
  max_downloads integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shared_links_target_check CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL) OR 
    (file_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- Create file_versions table for version history
CREATE TABLE public.file_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  change_notes text,
  UNIQUE(document_id, version_number)
);

-- Create storage bucket for files if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-files', 
  'shared-files', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Add folder_id to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS file_size bigint,
ADD COLUMN IF NOT EXISTS mime_type text,
ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

-- Enable RLS on new tables
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders
CREATE POLICY "Users can view their own folders and shared folders" 
ON public.folders FOR SELECT 
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  )
);

CREATE POLICY "Users can create folders" 
ON public.folders FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own folders" 
ON public.folders FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own folders" 
ON public.folders FOR DELETE 
USING (created_by = auth.uid());

-- RLS policies for shared_links
CREATE POLICY "Users can view their own shared links" 
ON public.shared_links FOR SELECT 
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  )
);

CREATE POLICY "Users can create shared links for their files" 
ON public.shared_links FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own shared links" 
ON public.shared_links FOR UPDATE 
USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own shared links" 
ON public.shared_links FOR DELETE 
USING (created_by = auth.uid());

-- RLS policies for file_versions
CREATE POLICY "Users can view versions of accessible files" 
ON public.file_versions FOR SELECT 
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.documents d 
    WHERE d.id = document_id AND (
      d.artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gallery_admin')
    )
  )
);

CREATE POLICY "Users can create versions for accessible files" 
ON public.file_versions FOR INSERT 
WITH CHECK (created_by = auth.uid());

-- Storage policies for shared-files bucket
CREATE POLICY "Users can upload to shared-files bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shared-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view files in shared-files bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'shared-files');

CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'shared-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'shared-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for performance
CREATE INDEX idx_folders_parent_id ON public.folders(parent_folder_id);
CREATE INDEX idx_folders_created_by ON public.folders(created_by);
CREATE INDEX idx_documents_folder_id ON public.documents(folder_id);
CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_expires_at ON public.shared_links(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_file_versions_document_id ON public.file_versions(document_id);
CREATE INDEX idx_documents_is_deleted ON public.documents(is_deleted) WHERE is_deleted = false;
