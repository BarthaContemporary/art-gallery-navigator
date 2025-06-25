
-- Add artist_id to folders table to link folders to specific artists
ALTER TABLE public.folders 
ADD COLUMN artist_id uuid REFERENCES public.artists(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_folders_artist_id ON public.folders(artist_id);

-- Update RLS policies for folders to restrict access based on artist ownership
DROP POLICY IF EXISTS "Users can view their own folders and shared folders" ON public.folders;
DROP POLICY IF EXISTS "Users can create folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;

-- New RLS policies for artist-specific folder access
CREATE POLICY "Artists can view their own folders and admins can view all" 
ON public.folders FOR SELECT 
USING (
  -- Admin users can see all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only see their own folders
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Users can see folders they created (for backwards compatibility)
  created_by = auth.uid()
);

CREATE POLICY "Artists can create folders in their own space and admins can create anywhere" 
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
  -- Users can create general folders (for backwards compatibility)
  (artist_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY "Artists can update their own folders and admins can update all" 
ON public.folders FOR UPDATE 
USING (
  -- Admin users can update all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only update their own folders
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Users can update folders they created (for backwards compatibility)
  created_by = auth.uid()
);

CREATE POLICY "Artists can delete their own folders and admins can delete all" 
ON public.folders FOR DELETE 
USING (
  -- Admin users can delete all folders
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Artists can only delete their own folders
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  )) OR
  -- Users can delete folders they created (for backwards compatibility)
  created_by = auth.uid()
);

-- Update documents table policies to respect artist folder access
DROP POLICY IF EXISTS "Users can view their own documents and shared documents" ON public.documents;

CREATE POLICY "Users can view documents based on folder access" 
ON public.documents FOR SELECT 
USING (
  -- Admin users can see all documents
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  ) OR
  -- Documents in artist folders - artist can see their own
  (folder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.folders f
    JOIN public.artists a ON f.artist_id = a.id
    WHERE f.id = folder_id AND a.user_id = auth.uid()
  )) OR
  -- Documents linked to artist's artworks
  (artwork_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artworks aw
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE aw.id = artwork_id AND art.user_id = auth.uid()
  )) OR
  -- Documents linked to artist's collections
  (collection_id IS NOT NULL AND public.is_collection_accessible_by_current_artist(collection_id)) OR
  -- Documents linked directly to artist
  (artist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id AND user_id = auth.uid()
  ))
);

-- Function to automatically create artist folders
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create artist folders
DROP TRIGGER IF EXISTS create_artist_folder ON public.artists;
CREATE TRIGGER create_artist_folder
  AFTER INSERT OR UPDATE OF user_id, full_name ON public.artists
  FOR EACH ROW
  EXECUTE FUNCTION public.create_artist_folder_if_needed();

-- Create folders for existing artists who have user accounts
INSERT INTO public.folders (name, artist_id, created_by)
SELECT 
  a.full_name || '''s Files' as name,
  a.id as artist_id,
  a.user_id as created_by
FROM public.artists a
WHERE a.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.folders f 
    WHERE f.artist_id = a.id
  );
