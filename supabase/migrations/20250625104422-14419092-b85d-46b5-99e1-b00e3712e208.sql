
-- Create folders for existing artists who have user accounts but don't have folders yet
INSERT INTO public.folders (name, artist_id, created_by)
SELECT 
  a.full_name || '''s Files' as name,
  a.id as artist_id,
  a.user_id as created_by
FROM public.artists a
WHERE a.user_id IS NOT NULL  -- Only for artists linked to user accounts
  AND NOT EXISTS (
    SELECT 1 FROM public.folders f 
    WHERE f.artist_id = a.id
  );

-- Also update the trigger function to handle name changes
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
      INSERT INTO public.folders (name, artist_id, created_by)
      VALUES (NEW.full_name || '''s Files', NEW.id, NEW.user_id);
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
