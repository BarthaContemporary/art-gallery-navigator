
-- First, completely drop the view and any dependencies
DROP VIEW IF EXISTS public.artist_folder_overview CASCADE;

-- Recreate the view with explicit schema qualification and no SECURITY DEFINER
CREATE VIEW public.artist_folder_overview AS
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
ORDER BY a.full_name;

-- Ensure the view has proper ownership
ALTER VIEW public.artist_folder_overview OWNER TO postgres;
