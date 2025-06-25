
-- First, let's add some sample artists linked to user accounts for testing
-- Note: You'll need to replace the user_id values with actual user IDs from your auth.users table

-- Create a function to help link artists to users
CREATE OR REPLACE FUNCTION public.link_artist_to_user(
  artist_name TEXT,
  user_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user_id UUID;
  found_artist_id UUID;
BEGIN
  -- Find user by email
  SELECT au.id INTO found_user_id
  FROM auth.users au
  WHERE au.email = user_email;
  
  IF found_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', user_email;
    RETURN FALSE;
  END IF;
  
  -- Find artist by name
  SELECT a.id INTO found_artist_id
  FROM public.artists a
  WHERE a.full_name ILIKE '%' || artist_name || '%'
  LIMIT 1;
  
  IF found_artist_id IS NULL THEN
    RAISE NOTICE 'Artist with name % not found', artist_name;
    RETURN FALSE;
  END IF;
  
  -- Link artist to user
  UPDATE public.artists
  SET user_id = found_user_id,
      updated_at = NOW()
  WHERE id = found_artist_id;
  
  RAISE NOTICE 'Successfully linked artist % to user %', artist_name, user_email;
  RETURN TRUE;
END;
$$;

-- Add a column to track folder assignment method for debugging
ALTER TABLE public.folders 
ADD COLUMN IF NOT EXISTS assignment_method TEXT DEFAULT 'manual';

-- Update the artist folder creation trigger to set assignment method
CREATE OR REPLACE FUNCTION public.create_artist_folder_if_needed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create folder if artist has a user_id (is linked to a user account)
  IF NEW.user_id IS NOT NULL THEN
    -- Check if folder already exists for this artist
    IF NOT EXISTS (
      SELECT 1 FROM public.folders 
      WHERE artist_id = NEW.id
    ) THEN
      -- Create the artist's folder
      INSERT INTO public.folders (name, artist_id, created_by, assignment_method)
      VALUES (NEW.full_name || '''s Files', NEW.id, NEW.user_id, 'auto_trigger');
    ELSE
      -- Update folder name if artist name changed
      UPDATE public.folders 
      SET name = NEW.full_name || '''s Files',
          updated_at = NOW()
      WHERE artist_id = NEW.id 
        AND name != NEW.full_name || '''s Files';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_artist_id ON public.folders(artist_id);
CREATE INDEX IF NOT EXISTS idx_artists_user_id ON public.artists(user_id);

-- Create a view to easily see artist-folder relationships
CREATE OR REPLACE VIEW public.artist_folder_overview AS
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
