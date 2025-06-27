
-- Create a temporary debug function to see what folders exist and why they're not accessible
CREATE OR REPLACE FUNCTION public.debug_webdav_folder_access()
RETURNS TABLE(
  folder_id uuid, 
  folder_name text, 
  artist_id uuid, 
  created_by uuid, 
  parent_folder_id uuid,
  current_user_id uuid,
  is_admin boolean,
  artist_user_id uuid,
  matches_artist boolean,
  matches_creator boolean,
  should_be_accessible boolean
)
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
  
  RETURN QUERY
  SELECT 
    f.id as folder_id,
    f.name as folder_name,
    f.artist_id,
    f.created_by,
    f.parent_folder_id,
    current_user_id,
    user_is_admin as is_admin,
    a.user_id as artist_user_id,
    (a.user_id = current_user_id) as matches_artist,
    (f.created_by = current_user_id) as matches_creator,
    (user_is_admin OR a.user_id = current_user_id OR f.created_by = current_user_id) as should_be_accessible
  FROM public.folders f
  LEFT JOIN public.artists a ON f.artist_id = a.id
  WHERE f.parent_folder_id IS NULL -- Only root level folders
  ORDER BY f.name;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.debug_webdav_folder_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_webdav_folder_access() TO service_role;
