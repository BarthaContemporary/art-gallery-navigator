
-- Fix the mutable search_path security vulnerability in these functions
-- by setting a secure search_path

-- Fix public.get_artist_folder_access
CREATE OR REPLACE FUNCTION public.get_artist_folder_access(folder_id uuid)
RETURNS TABLE(can_access boolean, artist_id uuid) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  folder_artist_id uuid;
BEGIN
  -- Get the artist_id for this folder or its parent hierarchy
  folder_artist_id := public.get_folder_artist_access(folder_id);
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN public.is_user_admin() THEN true
      WHEN folder_artist_id IS NOT NULL AND public.is_artist_owner(folder_artist_id) THEN true
      ELSE false
    END as can_access,
    folder_artist_id as artist_id;
END;
$$;

-- Fix public.is_user_admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean 
LANGUAGE plpgsql 
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  );
END;
$$;

-- Fix public.is_artist_owner
CREATE OR REPLACE FUNCTION public.is_artist_owner(artist_id_param uuid)
RETURNS boolean 
LANGUAGE plpgsql 
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id_param AND user_id = auth.uid()
  );
END;
$$;

-- Fix public.get_folder_artist_access
CREATE OR REPLACE FUNCTION public.get_folder_artist_access(folder_id_param uuid)
RETURNS uuid 
LANGUAGE plpgsql 
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result_artist_id uuid;
BEGIN
  -- Traverse up the folder tree to find the artist_id
  WITH RECURSIVE folder_hierarchy AS (
    -- Base case: start with the given folder
    SELECT id, parent_folder_id, artist_id, 0 as level
    FROM public.folders 
    WHERE id = folder_id_param
    
    UNION ALL
    
    -- Recursive case: go up to parent folders
    SELECT f.id, f.parent_folder_id, f.artist_id, fh.level + 1
    FROM public.folders f
    INNER JOIN folder_hierarchy fh ON f.id = fh.parent_folder_id
    WHERE fh.level < 20 -- Prevent infinite loops
  )
  SELECT artist_id INTO result_artist_id
  FROM folder_hierarchy 
  WHERE artist_id IS NOT NULL 
  LIMIT 1;
  
  RETURN result_artist_id;
END;
$$;
