
-- Step 1: Fix RLS Policies - Handle existing policies safely

-- Artists table - Only allow artists to manage their own records
DROP POLICY IF EXISTS "Artists can view all artist profiles" ON public.artists;
DROP POLICY IF EXISTS "Artists can insert their own profile" ON public.artists;
DROP POLICY IF EXISTS "Artists can update their own profile" ON public.artists;
DROP POLICY IF EXISTS "Artists can delete their own profile" ON public.artists;

CREATE POLICY "Artists can view all artist profiles" ON public.artists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Artists can insert their own profile" ON public.artists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Artists can update their own profile" ON public.artists FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Artists can delete their own profile" ON public.artists FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Artworks table - Only allow artists to manage their own artworks
DROP POLICY IF EXISTS "Anyone can view artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can create artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can update their own artworks" ON public.artworks;
DROP POLICY IF EXISTS "Artists can delete their own artworks" ON public.artworks;

CREATE POLICY "Anyone can view artworks" ON public.artworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Artists can create artworks" ON public.artworks FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.artists WHERE artists.id = artworks.artist_id AND artists.user_id = auth.uid())
);
CREATE POLICY "Artists can update their own artworks" ON public.artworks FOR UPDATE TO authenticated 
  USING (public.is_artwork_owned_by_current_user(id)) 
  WITH CHECK (public.is_artwork_owned_by_current_user(id));
CREATE POLICY "Artists can delete their own artworks" ON public.artworks FOR DELETE TO authenticated 
  USING (public.is_artwork_owned_by_current_user(id));

-- Artwork Images table - Only allow artists to manage images for their artworks
DROP POLICY IF EXISTS "Anyone can view artwork images" ON public.artwork_images;
DROP POLICY IF EXISTS "Artists can add images to their artworks" ON public.artwork_images;
DROP POLICY IF EXISTS "Artists can update images for their artworks" ON public.artwork_images;
DROP POLICY IF EXISTS "Artists can delete images from their artworks" ON public.artwork_images;

CREATE POLICY "Anyone can view artwork images" ON public.artwork_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Artists can add images to their artworks" ON public.artwork_images FOR INSERT TO authenticated WITH CHECK (
  public.is_artwork_owned_by_current_user(artwork_id)
);
CREATE POLICY "Artists can update images for their artworks" ON public.artwork_images FOR UPDATE TO authenticated 
  USING (public.is_artwork_owned_by_current_user(artwork_id))
  WITH CHECK (public.is_artwork_owned_by_current_user(artwork_id));
CREATE POLICY "Artists can delete images from their artworks" ON public.artwork_images FOR DELETE TO authenticated 
  USING (public.is_artwork_owned_by_current_user(artwork_id));

-- Collections table - Admins can manage, others can view
DROP POLICY IF EXISTS "Anyone can view collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can manage collections" ON public.collections;

CREATE POLICY "Anyone can view collections" ON public.collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage collections" ON public.collections FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));

-- User Roles table - Only admins can manage roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'gallery_admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'gallery_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'gallery_admin'));

-- Profiles table - Users can manage their own profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated 
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Add rate limiting table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins can view security events
DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events" ON public.security_events FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'gallery_admin'));

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type TEXT,
  _ip_address INET DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.security_events (user_id, event_type, ip_address, user_agent, details)
  VALUES (auth.uid(), _event_type, _ip_address, _user_agent, _details)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;
