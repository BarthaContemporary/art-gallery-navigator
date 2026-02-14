
-- =============================================
-- Audio Library: Tables, RLS, Triggers, Storage
-- =============================================

-- 1. audio_tracks
CREATE TABLE public.audio_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  artist text,
  series text,
  description text,
  tags text[],
  duration_seconds integer,
  date_published date,
  cover_image_url text,
  storage_key text,
  visibility text NOT NULL DEFAULT 'public',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;

-- 2. audio_collections
CREATE TABLE public.audio_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  visibility text NOT NULL DEFAULT 'public',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_collections ENABLE ROW LEVEL SECURITY;

-- 3. audio_collection_items
CREATE TABLE public.audio_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.audio_collections(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (collection_id, track_id)
);

ALTER TABLE public.audio_collection_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- audio_tracks: public can see public tracks
CREATE POLICY "Public can view public tracks"
  ON public.audio_tracks FOR SELECT
  USING (visibility = 'public');

-- audio_tracks: authenticated admins see all
CREATE POLICY "Admins can view all tracks"
  ON public.audio_tracks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- audio_tracks: admin CUD
CREATE POLICY "Admins can insert tracks"
  ON public.audio_tracks FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can update tracks"
  ON public.audio_tracks FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can delete tracks"
  ON public.audio_tracks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- audio_collections: public can see public
CREATE POLICY "Public can view public collections"
  ON public.audio_collections FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Admins can view all collections"
  ON public.audio_collections FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can insert collections"
  ON public.audio_collections FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can update collections"
  ON public.audio_collections FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can delete collections"
  ON public.audio_collections FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- audio_collection_items: public can see items of public collections
CREATE POLICY "Public can view items of public collections"
  ON public.audio_collection_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.audio_collections ac
    WHERE ac.id = collection_id AND ac.visibility = 'public'
  ));

CREATE POLICY "Admins can view all collection items"
  ON public.audio_collection_items FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can insert collection items"
  ON public.audio_collection_items FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can update collection items"
  ON public.audio_collection_items FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can delete collection items"
  ON public.audio_collection_items FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- =============================================
-- Slug generation triggers
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_audio_track_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.audio_tracks WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_audio_track_slug_trigger
  BEFORE INSERT ON public.audio_tracks
  FOR EACH ROW EXECUTE FUNCTION public.generate_audio_track_slug();

CREATE OR REPLACE FUNCTION public.generate_audio_collection_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM public.audio_collections WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_audio_collection_slug_trigger
  BEFORE INSERT ON public.audio_collections
  FOR EACH ROW EXECUTE FUNCTION public.generate_audio_collection_slug();

-- =============================================
-- Updated_at triggers
-- =============================================

CREATE TRIGGER update_audio_tracks_updated_at
  BEFORE UPDATE ON public.audio_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audio_collections_updated_at
  BEFORE UPDATE ON public.audio_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Storage bucket
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio bucket
CREATE POLICY "Public can read audio files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio');

CREATE POLICY "Admins can upload audio files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio' AND public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can update audio files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can delete audio files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'gallery_admin'::user_role));
