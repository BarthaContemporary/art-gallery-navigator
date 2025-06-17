
-- Create storage bucket for artwork videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('artwork-videos', 'artwork-videos', false);

-- Create storage policy for artwork videos
CREATE POLICY "Authenticated users can upload artwork videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'artwork-videos' 
  AND auth.role() = 'authenticated'
  AND (public.has_role(auth.uid(), 'gallery_admin') OR 
       EXISTS (SELECT 1 FROM public.artists WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can view artwork videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'artwork-videos' 
  AND (public.has_role(auth.uid(), 'gallery_admin') OR 
       EXISTS (SELECT 1 FROM public.artists WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can update their artwork videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'artwork-videos' 
  AND auth.role() = 'authenticated'
  AND (public.has_role(auth.uid(), 'gallery_admin') OR 
       EXISTS (SELECT 1 FROM public.artists WHERE user_id = auth.uid()))
);

CREATE POLICY "Users can delete their artwork videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'artwork-videos' 
  AND auth.role() = 'authenticated'
  AND (public.has_role(auth.uid(), 'gallery_admin') OR 
       EXISTS (SELECT 1 FROM public.artists WHERE user_id = auth.uid()))
);

-- Create artwork_videos table to track video uploads and Vimeo links
CREATE TABLE public.artwork_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase storage URL
  vimeo_video_id TEXT, -- Vimeo video ID after upload
  vimeo_url TEXT, -- Full Vimeo URL
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
  file_size BIGINT,
  duration_seconds INTEGER,
  thumbnail_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on artwork_videos
ALTER TABLE public.artwork_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for artwork_videos
CREATE POLICY "Anyone can view artwork videos" ON public.artwork_videos
FOR SELECT USING (
  artwork_id IN (
    SELECT id FROM public.artworks 
    WHERE status = 'available' 
    OR public.has_role(auth.uid(), 'gallery_admin')
    OR artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Artists and admins can manage artwork videos" ON public.artwork_videos
FOR ALL USING (
  artwork_id IN (
    SELECT id FROM public.artworks 
    WHERE artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'gallery_admin')
);

-- Function to ensure only one primary video per artwork
CREATE OR REPLACE FUNCTION public.ensure_single_primary_video()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        UPDATE public.artwork_videos
        SET is_primary = false
        WHERE artwork_id = NEW.artwork_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for single primary video
CREATE TRIGGER ensure_single_primary_video_trigger
    BEFORE INSERT OR UPDATE ON public.artwork_videos
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_single_primary_video();

-- Create index for performance
CREATE INDEX idx_artwork_videos_artwork_id ON public.artwork_videos(artwork_id);
CREATE INDEX idx_artwork_videos_primary ON public.artwork_videos(artwork_id, is_primary);
