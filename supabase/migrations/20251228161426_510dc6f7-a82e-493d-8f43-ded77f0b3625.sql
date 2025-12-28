-- Drop existing restrictive policies that are causing issues
DROP POLICY IF EXISTS "Gallery admins can manage artists" ON public.artists;
DROP POLICY IF EXISTS "Artists can manage own profile" ON public.artists;
DROP POLICY IF EXISTS "Gallery admins can manage sales" ON public.sales;
DROP POLICY IF EXISTS "Artists can view own artwork sales" ON public.sales;
DROP POLICY IF EXISTS "Gallery admins can manage collections" ON public.collections;
DROP POLICY IF EXISTS "Artists can view accessible collections" ON public.collections;
DROP POLICY IF EXISTS "Gallery admins can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Gallery admins can manage client_communications" ON public.client_communications;

-- ARTISTS TABLE: Gallery admins + artists can manage their own profile
CREATE POLICY "Gallery admins can manage artists" 
ON public.artists FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Artists can manage own profile" 
ON public.artists FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- COLLECTIONS TABLE: Gallery admins full access, artists can view their accessible collections
CREATE POLICY "Gallery admins can manage collections" 
ON public.collections FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Artists can view accessible collections" 
ON public.collections FOR SELECT
TO authenticated
USING (public.is_collection_accessible_by_current_artist(id));

-- SALES TABLE: Gallery admins full access, artists can view sales of their artworks
CREATE POLICY "Gallery admins can manage sales" 
ON public.sales FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Artists can view own artwork sales" 
ON public.sales FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.artworks a
    JOIN public.artists ar ON a.artist_id = ar.id
    WHERE a.id = sales.artwork_id AND ar.user_id = auth.uid()
  )
);

-- CLIENTS TABLE: Gallery admins only (sensitive customer data)
CREATE POLICY "Gallery admins can manage clients" 
ON public.clients FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));

-- CLIENT_COMMUNICATIONS TABLE: Gallery admins only (highly sensitive)
CREATE POLICY "Gallery admins can manage client_communications" 
ON public.client_communications FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'gallery_admin'::user_role));