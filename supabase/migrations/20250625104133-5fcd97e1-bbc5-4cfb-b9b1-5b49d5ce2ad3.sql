
-- Drop the problematic policies first
DROP POLICY IF EXISTS "Folder access control" ON public.folders;
DROP POLICY IF EXISTS "Folder creation control" ON public.folders;
DROP POLICY IF EXISTS "Folder update control" ON public.folders;
DROP POLICY IF EXISTS "Folder deletion control" ON public.folders;

-- Create helper functions to avoid recursion in policies
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_artist_owner(artist_id_param uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id_param AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_folder_artist_access(folder_id_param uuid)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create simple, non-recursive policies
CREATE POLICY "Folder access policy" 
ON public.folders FOR SELECT 
USING (
  public.is_user_admin() OR
  (artist_id IS NOT NULL AND public.is_artist_owner(artist_id)) OR
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND public.is_artist_owner(public.get_folder_artist_access(id))) OR
  (artist_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder insert policy" 
ON public.folders FOR INSERT 
WITH CHECK (
  public.is_user_admin() OR
  (artist_id IS NOT NULL AND public.is_artist_owner(artist_id)) OR
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND public.is_artist_owner(public.get_folder_artist_access(parent_folder_id))) OR
  (artist_id IS NULL AND parent_folder_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder update policy" 
ON public.folders FOR UPDATE 
USING (
  public.is_user_admin() OR
  (artist_id IS NOT NULL AND public.is_artist_owner(artist_id)) OR
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND public.is_artist_owner(public.get_folder_artist_access(id))) OR
  (artist_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder delete policy" 
ON public.folders FOR DELETE 
USING (
  public.is_user_admin() OR
  (artist_id IS NOT NULL AND public.is_artist_owner(artist_id)) OR
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND public.is_artist_owner(public.get_folder_artist_access(id))) OR
  (artist_id IS NULL AND created_by = auth.uid())
);

-- Update the get_artist_folder_access function to be simpler
CREATE OR REPLACE FUNCTION public.get_artist_folder_access(folder_id uuid)
RETURNS TABLE(can_access boolean, artist_id uuid) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
