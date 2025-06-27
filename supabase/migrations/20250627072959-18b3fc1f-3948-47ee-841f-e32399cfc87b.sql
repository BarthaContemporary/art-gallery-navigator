
-- Debug and fix WebDAV folder access by checking what folders exist and improving access logic

-- First, let's create a more permissive version that shows what's actually in the database
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
  
  -- Log some debug info
  RAISE LOG 'WebDAV folder access: user_id=%, is_admin=%', current_user_id, user_is_admin;
  
  IF user_is_admin THEN
    -- Admin can access all folders (both root and sub-folders for now to debug)
    RETURN QUERY
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      COALESCE(f.path, '/' || f.name) as folder_path,
      f.artist_id,
      f.parent_folder_id,
      true as can_read,
      true as can_write
    FROM public.folders f
    ORDER BY f.name;
  ELSE
    -- For non-admin users, be more permissive to see what we can access
    RETURN QUERY
    SELECT 
      f.id as folder_id,
      f.name as folder_name,
      COALESCE(f.path, '/' || f.name) as folder_path,
      f.artist_id,
      f.parent_folder_id,
      true as can_read,
      true as can_write
    FROM public.folders f
    LEFT JOIN public.artists a ON f.artist_id = a.id
    WHERE (
      -- User owns the artist folder
      a.user_id = current_user_id OR 
      -- User created the folder
      f.created_by = current_user_id OR
      -- Folder has no artist assigned (general access)
      f.artist_id IS NULL
    )
    ORDER BY f.name;
  END IF;
  
  -- Log how many folders we're returning
  GET DIAGNOSTICS current_user_id = ROW_COUNT;
  RAISE LOG 'WebDAV returning % folders', current_user_id;
END;
$$;

-- Also create a simple debug function to see what folders exist
CREATE OR REPLACE FUNCTION public.debug_folder_info()
RETURNS TABLE(folder_count bigint, root_folder_count bigint, user_created_count bigint, artist_linked_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.folders) as folder_count,
    (SELECT COUNT(*) FROM public.folders WHERE parent_folder_id IS NULL) as root_folder_count,
    (SELECT COUNT(*) FROM public.folders WHERE created_by = current_user_id) as user_created_count,
    (SELECT COUNT(*) FROM public.folders f LEFT JOIN public.artists a ON f.artist_id = a.id WHERE a.user_id = current_user_id) as artist_linked_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.debug_folder_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_folder_info() TO service_role;
