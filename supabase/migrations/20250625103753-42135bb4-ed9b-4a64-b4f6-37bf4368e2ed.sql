
-- Update RLS policies for folders to ensure proper artist-specific access control
DROP POLICY IF EXISTS "Artists can view their own folders and admins can view all" ON public.folders;
DROP POLICY IF EXISTS "Artists can create folders in their own space and admins can create anywhere" ON public.folders;
DROP POLICY IF EXISTS "Artists can update their own folders and admins can update all" ON public.folders;
DROP POLICY IF EXISTS "Artists can delete their own folders and admins can delete all" ON public.folders;

-- Create comprehensive RLS policies for artist folder access
CREATE POLICY "Folder access control" 
ON public.folders FOR SELECT 
USING (
  -- Admin users can see all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only see their own folders (root and nested)
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Artists can see subfolders within their own artist folders
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE folder_tree AS (
      -- Base case: start with the current folder
      SELECT id, parent_folder_id, artist_id, 1 as level
      FROM public.folders 
      WHERE id = folders.parent_folder_id
      
      UNION ALL
      
      -- Recursive case: traverse up the folder tree
      SELECT f.id, f.parent_folder_id, f.artist_id, ft.level + 1
      FROM public.folders f
      INNER JOIN folder_tree ft ON f.id = ft.parent_folder_id
      WHERE ft.level < 10 -- Prevent infinite recursion
    )
    SELECT 1 FROM folder_tree ft
    JOIN public.artists a ON ft.artist_id = a.id
    WHERE a.user_id = auth.uid()
  )) OR
  -- Users can see folders they created (for backwards compatibility with non-artist folders)
  (artist_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder creation control" 
ON public.folders FOR INSERT 
WITH CHECK (
  -- Admin users can create folders anywhere
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can create folders assigned to them
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Artists can create subfolders within their own artist folders
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE folder_tree AS (
      -- Base case: start with the parent folder
      SELECT id, parent_folder_id, artist_id, 1 as level
      FROM public.folders 
      WHERE id = folders.parent_folder_id
      
      UNION ALL
      
      -- Recursive case: traverse up the folder tree
      SELECT f.id, f.parent_folder_id, f.artist_id, ft.level + 1
      FROM public.folders f
      INNER JOIN folder_tree ft ON f.id = ft.parent_folder_id
      WHERE ft.level < 10 -- Prevent infinite recursion
    )
    SELECT 1 FROM folder_tree ft
    JOIN public.artists a ON ft.artist_id = a.id
    WHERE a.user_id = auth.uid()
  )) OR
  -- Users can create general folders (for backwards compatibility)
  (artist_id IS NULL AND parent_folder_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder update control" 
ON public.folders FOR UPDATE 
USING (
  -- Admin users can update all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only update their own folders (root and nested)
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Artists can update subfolders within their own artist folders
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE folder_tree AS (
      -- Base case: start with the current folder
      SELECT id, parent_folder_id, artist_id, 1 as level
      FROM public.folders 
      WHERE id = folders.parent_folder_id
      
      UNION ALL
      
      -- Recursive case: traverse up the folder tree
      SELECT f.id, f.parent_folder_id, f.artist_id, ft.level + 1
      FROM public.folders f
      INNER JOIN folder_tree ft ON f.id = ft.parent_folder_id
      WHERE ft.level < 10 -- Prevent infinite recursion
    )
    SELECT 1 FROM folder_tree ft
    JOIN public.artists a ON ft.artist_id = a.id
    WHERE a.user_id = auth.uid()
  )) OR
  -- Users can update folders they created (for backwards compatibility)
  (artist_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Folder deletion control" 
ON public.folders FOR DELETE 
USING (
  -- Admin users can delete all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only delete their own folders (root and nested)
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Artists can delete subfolders within their own artist folders
  (artist_id IS NULL AND parent_folder_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE folder_tree AS (
      -- Base case: start with the current folder
      SELECT id, parent_folder_id, artist_id, 1 as level
      FROM public.folders 
      WHERE id = folders.parent_folder_id
      
      UNION ALL
      
      -- Recursive case: traverse up the folder tree
      SELECT f.id, f.parent_folder_id, f.artist_id, ft.level + 1
      FROM public.folders f
      INNER JOIN folder_tree ft ON f.id = ft.parent_folder_id
      WHERE ft.level < 10 -- Prevent infinite recursion
    )
    SELECT 1 FROM folder_tree ft
    JOIN public.artists a ON ft.artist_id = a.id
    WHERE a.user_id = auth.uid()
  )) OR
  -- Users can delete folders they created (for backwards compatibility)
  (artist_id IS NULL AND created_by = auth.uid())
);

-- Create function to get artist folder access
CREATE OR REPLACE FUNCTION public.get_artist_folder_access(folder_id uuid)
RETURNS TABLE(can_access boolean, artist_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    -- Base case: start with the given folder
    SELECT f.id, f.parent_folder_id, f.artist_id, 1 as level
    FROM public.folders f
    WHERE f.id = folder_id
    
    UNION ALL
    
    -- Recursive case: traverse up the folder tree
    SELECT f.id, f.parent_folder_id, f.artist_id, ft.level + 1
    FROM public.folders f
    INNER JOIN folder_tree ft ON f.id = ft.parent_folder_id
    WHERE ft.level < 10 -- Prevent infinite recursion
  )
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'gallery_admin'
      ) THEN true
      WHEN EXISTS (
        SELECT 1 FROM folder_tree ft
        JOIN public.artists a ON ft.artist_id = a.id
        WHERE a.user_id = auth.uid()
      ) THEN true
      ELSE false
    END as can_access,
    COALESCE(
      (SELECT ft.artist_id FROM folder_tree ft WHERE ft.artist_id IS NOT NULL LIMIT 1),
      NULL
    ) as artist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
