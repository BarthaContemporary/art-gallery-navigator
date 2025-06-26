
-- Create the missing RPC functions that the WebDAV server expects

-- Function to get user accessible folders for WebDAV
CREATE OR REPLACE FUNCTION public.get_user_accessible_folders()
RETURNS TABLE(folder_id uuid, folder_name text, folder_path text, artist_id uuid, parent_folder_id uuid, can_read boolean, can_write boolean)
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
    -- Admin can access all folders
    RETURN QUERY
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      f.path as folder_path,
      f.artist_id,
      f.parent_folder_id,
      true as can_read,
      true as can_write
    FROM public.folders f
    ORDER BY f.name;
  ELSE
    -- Regular users can only access folders for artists they're linked to
    RETURN QUERY
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      f.path as folder_path,
      f.artist_id,
      f.parent_folder_id,
      true as can_read,
      true as can_write
    FROM public.folders f
    INNER JOIN public.artists a ON f.artist_id = a.id
    WHERE a.user_id = current_user_id
    ORDER BY f.name;
  END IF;
END;
$$;

-- Function to get user accessible documents for WebDAV
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
    WHERE d.is_deleted = false
      AND (folder_id_param IS NULL OR d.folder_id = folder_id_param)
    ORDER BY d.file_name;
  ELSE
    -- Regular users can only access documents for artists they're linked to
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
    WHERE d.is_deleted = false
      AND (folder_id_param IS NULL OR d.folder_id = folder_id_param)
      AND (
        (d.artist_id IS NOT NULL AND a.user_id = current_user_id) OR
        (d.folder_id IS NOT NULL AND fa.user_id = current_user_id)
      )
    ORDER BY d.file_name;
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_accessible_folders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_folders() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_documents(uuid) TO service_role;
