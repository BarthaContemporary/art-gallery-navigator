
-- Drop the existing view completely
DROP VIEW IF EXISTS public.artist_folder_overview CASCADE;

-- Instead of creating a view, let's create a SECURITY DEFINER function that respects RLS
-- This approach ensures proper permission checking for each querying user
CREATE OR REPLACE FUNCTION public.get_artist_folder_overview()
RETURNS TABLE(
  artist_id uuid,
  artist_name text,
  user_id uuid,
  user_email text,
  folder_id uuid,
  folder_name text,
  assignment_method text,
  folder_created_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as artist_id,
    a.full_name as artist_name,
    a.user_id,
    p.display_name as user_email,
    f.id as folder_id,
    f.name as folder_name,
    f.assignment_method,
    f.created_at as folder_created_at,
    CASE 
      WHEN a.user_id IS NOT NULL AND f.id IS NOT NULL THEN 'linked_with_folder'
      WHEN a.user_id IS NOT NULL AND f.id IS NULL THEN 'linked_no_folder'
      WHEN a.user_id IS NULL AND f.id IS NOT NULL THEN 'folder_no_user'
      ELSE 'no_link_no_folder'
    END as status
  FROM public.artists a
  LEFT JOIN public.folders f ON a.id = f.artist_id
  LEFT JOIN public.profiles p ON a.user_id = p.id
  WHERE 
    -- Ensure RLS is respected: only show data the current user can access
    (public.is_user_admin() OR 
     (a.user_id IS NOT NULL AND a.user_id = auth.uid()) OR
     (f.id IS NOT NULL AND EXISTS(
       SELECT 1 FROM (SELECT * FROM public.get_artist_folder_access(f.id)) AS access_check WHERE access_check.can_access = true
     )))
  ORDER BY a.full_name;
END;
$$;
