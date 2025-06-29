
-- Create the missing shared-files storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shared-files', 
  'shared-files', 
  true, 
  52428800, -- 50MB limit
  NULL -- Allow all file types for WebDAV compatibility
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = NULL;

-- Create storage policies for shared-files bucket
CREATE POLICY "Authenticated users can upload to shared-files bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shared-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public read access to shared-files bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'shared-files');

CREATE POLICY "Users can update their own files in shared-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'shared-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own files in shared-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'shared-files' AND auth.uid() IS NOT NULL);

-- Update documents table RLS policies to ensure WebDAV uploads are visible
DROP POLICY IF EXISTS "Users can view documents based on folder access" ON public.documents;

-- Create a more permissive policy for WebDAV document access
CREATE POLICY "Users can view accessible documents" 
ON public.documents FOR SELECT 
USING (
  -- Admin users can see all documents
  public.is_user_admin() OR
  -- Documents in folders the user can access
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.get_user_accessible_folders_for_user(auth.uid()) f
    WHERE f.folder_id = documents.folder_id
  )) OR
  -- Documents linked to user's artworks
  (artwork_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artworks aw
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE aw.id = artwork_id AND art.user_id = auth.uid()
  )) OR
  -- Documents linked to accessible collections
  (collection_id IS NOT NULL AND public.is_collection_accessible_by_current_artist(collection_id)) OR
  -- Documents linked directly to user's artist profile
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Documents created by the user (for general uploads)
  (artist_id IS NULL AND folder_id IS NULL)
);

-- Create insert policy for documents
CREATE POLICY "Users can create documents in accessible folders" 
ON public.documents FOR INSERT 
WITH CHECK (
  -- Admin users can create documents anywhere
  public.is_user_admin() OR
  -- Users can create documents in folders they can access
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.get_user_accessible_folders_for_user(auth.uid()) f
    WHERE f.folder_id = documents.folder_id AND f.can_write = true
  )) OR
  -- Users can create documents linked to their artworks/artists
  (artwork_id IS NOT NULL AND public.is_artwork_owned_by_current_user(artwork_id)) OR
  (artist_id IS NOT NULL AND public.is_artist_owner(artist_id)) OR
  -- Users can create general documents
  (artist_id IS NULL AND folder_id IS NULL)
);

-- Fix the get_user_accessible_documents function to work properly with WebDAV
CREATE OR REPLACE FUNCTION public.get_user_accessible_documents(folder_id_param uuid DEFAULT NULL::uuid)
RETURNS TABLE(document_id uuid, document_name text, file_url text, file_size bigint, mime_type text, folder_id uuid, artist_id uuid, can_read boolean, can_write boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_is_admin boolean;
BEGIN
  -- Check if user is admin
  user_is_admin := public.is_user_admin();
  
  IF user_is_admin THEN
    -- Admin can access all documents
    RETURN QUERY
    SELECT 
      d.id as document_id,
      d.file_name as document_name,
      d.file_url,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.artist_id,
      true as can_read,
      true as can_write
    FROM public.documents d
    WHERE (d.is_deleted = false OR d.is_deleted IS NULL)
      AND (folder_id_param IS NULL OR d.folder_id = folder_id_param)
    ORDER BY d.file_name;
  ELSE
    -- Regular users can access documents they have permission for
    RETURN QUERY
    SELECT 
      d.id as document_id,
      d.file_name as document_name,
      d.file_url,
      d.file_size,
      d.mime_type,
      d.folder_id,
      d.artist_id,
      true as can_read,
      true as can_write
    FROM public.documents d
    LEFT JOIN public.artists a ON d.artist_id = a.id
    LEFT JOIN public.folders f ON d.folder_id = f.id
    LEFT JOIN public.artists fa ON f.artist_id = fa.id
    WHERE (d.is_deleted = false OR d.is_deleted IS NULL)
      AND (folder_id_param IS NULL OR d.folder_id = folder_id_param)
      AND (
        -- User is linked to the document's artist
        (d.artist_id IS NOT NULL AND a.user_id = current_user_id) OR
        -- User can access the document's folder
        (d.folder_id IS NOT NULL AND (
          fa.user_id = current_user_id OR 
          f.created_by = current_user_id
        )) OR
        -- General documents not tied to specific artists/folders
        (d.artist_id IS NULL AND d.folder_id IS NULL)
      )
    ORDER BY d.file_name;
  END IF;
END;
$$;
