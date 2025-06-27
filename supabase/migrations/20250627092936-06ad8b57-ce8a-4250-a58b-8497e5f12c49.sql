
-- Fix the get_user_accessible_folders function to properly handle admin access
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
    -- Admin can access all root-level folders
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
    WHERE f.parent_folder_id IS NULL -- Only return root level folders for WebDAV
    ORDER BY f.name;
  ELSE
    -- Regular users can only access folders they own or are linked to via artist
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
    WHERE f.parent_folder_id IS NULL -- Only return root level folders for WebDAV
      AND (
        a.user_id = current_user_id OR -- User owns the artist folder
        f.created_by = current_user_id -- User created the folder
      )
    ORDER BY f.name;
  END IF;
END;
$$;
