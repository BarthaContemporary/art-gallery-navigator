
-- Create function to generate short IDs
CREATE OR REPLACE FUNCTION generate_short_id(length integer DEFAULT 6)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Viewer Artworks table
CREATE TABLE public.viewer_artworks (
  id text PRIMARY KEY DEFAULT generate_short_id(6),
  artist_name text NOT NULL,
  title text NOT NULL,
  year text,
  slug text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Viewer Artwork Images table
CREATE TABLE public.viewer_artwork_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id text NOT NULL REFERENCES public.viewer_artworks(id) ON DELETE CASCADE,
  original_url text NOT NULL,
  alt_text text,
  width integer,
  height integer,
  small_url text,
  medium_url text,
  large_url text,
  position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Viewer Embed Domains table
CREATE TABLE public.viewer_embed_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_viewer_artwork_images_artwork_id ON public.viewer_artwork_images(artwork_id);
CREATE INDEX idx_viewer_artworks_id ON public.viewer_artworks(id);

-- Enable RLS
ALTER TABLE public.viewer_artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewer_artwork_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewer_embed_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for viewer_artworks
CREATE POLICY "Public can view artworks" ON public.viewer_artworks
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage artworks" ON public.viewer_artworks
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- RLS Policies for viewer_artwork_images
CREATE POLICY "Public can view artwork images" ON public.viewer_artwork_images
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage artwork images" ON public.viewer_artwork_images
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- RLS Policies for viewer_embed_domains
CREATE POLICY "Public can view embed domains" ON public.viewer_embed_domains
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage embed domains" ON public.viewer_embed_domains
  FOR ALL USING (has_role(auth.uid(), 'gallery_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_viewer_artworks_updated_at
  BEFORE UPDATE ON public.viewer_artworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_viewer_artwork_images_updated_at
  BEFORE UPDATE ON public.viewer_artwork_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
