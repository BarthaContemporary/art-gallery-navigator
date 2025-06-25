
-- Fix the get_user_accessible_folders function to properly handle admin access
CREATE OR REPLACE FUNCTION public.get_user_accessible_folders()
RETURNS TABLE(
  folder_id uuid,
  folder_name text,
  folder_path text,
  artist_id uuid,
  parent_folder_id uuid,
  can_read boolean,
  can_write boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_is_admin boolean;
BEGIN
  -- Check if user is admin using the existing function
  SELECT public.is_user_admin() INTO user_is_admin;
  
  -- Add debug logging
  RAISE LOG 'get_user_accessible_folders: user_id=%, is_admin=%', current_user_id, user_is_admin;
  
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

-- Fix the get_user_accessible_documents function to properly handle admin access
CREATE OR REPLACE FUNCTION public.get_user_accessible_documents(folder_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  document_id uuid,
  document_name text,
  file_url text,
  file_size bigint,
  mime_type text,
  folder_id uuid,
  artist_id uuid,
  can_read boolean,
  can_write boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_is_admin boolean;
BEGIN
  -- Check if user is admin using the existing function
  SELECT public.is_user_admin() INTO user_is_admin;
  
  -- Add debug logging
  RAISE LOG 'get_user_accessible_documents: user_id=%, is_admin=%, folder_id=%', current_user_id, user_is_admin, folder_id_param;
  
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

-- Create a debug function to check WebDAV access status
CREATE OR REPLACE FUNCTION public.debug_webdav_access()
RETURNS TABLE(
  user_id uuid,
  is_admin boolean,
  folders_count bigint,
  documents_count bigint,
  artist_count bigint,
  user_roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  admin_status boolean;
  folders_accessible bigint;
  docs_accessible bigint;
  artists_linked bigint;
  roles_array text[];
BEGIN
  -- Get admin status
  SELECT public.is_user_admin() INTO admin_status;
  
  -- Count accessible folders
  SELECT COUNT(*) INTO folders_accessible
  FROM public.get_user_accessible_folders();
  
  -- Count accessible documents
  SELECT COUNT(*) INTO docs_accessible
  FROM public.get_user_accessible_documents();
  
  -- Count linked artists
  SELECT COUNT(*) INTO artists_linked
  FROM public.artists a
  WHERE a.user_id = current_user_id;
  
  -- Get user roles
  SELECT ARRAY_AGG(role::text) INTO roles_array
  FROM public.user_roles ur
  WHERE ur.user_id = current_user_id;
  
  RETURN QUERY
  SELECT 
    current_user_id,
    admin_status,
    folders_accessible,
    docs_accessible,
    artists_linked,
    COALESCE(roles_array, ARRAY[]::text[]);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.debug_webdav_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_webdav_access() TO service_role;

-- Create some sample test data for admin users if tables are empty
DO $$
DECLARE
  sample_folder_id uuid;
  sample_doc_id uuid;
BEGIN
  -- Only create sample data if folders table is empty
  IF NOT EXISTS (SELECT 1 FROM public.folders LIMIT 1) THEN
    -- Create a sample folder
    INSERT INTO public.folders (name, created_by, assignment_method)
    VALUES ('Sample WebDAV Folder', auth.uid(), 'manual')
    RETURNING id INTO sample_folder_id;
    
    -- Create a sample document
    INSERT INTO public.documents (
      file_name, 
      file_url, 
      type, 
      mime_type, 
      folder_id,
      file_size
    )
    VALUES (
      'sample-document.txt',
      'https://example.com/sample.txt',
      'document',
      'text/plain',
      sample_folder_id,
      1024
    );
    
    RAISE LOG 'Created sample WebDAV test data: folder_id=%, doc_id=%', sample_folder_id, sample_doc_id;
  END IF;
END;
$$;
