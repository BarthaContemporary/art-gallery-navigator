-- Security Fix 1: Tighten User Role Visibility
-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create restrictive policies for user_roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Admins can manage user roles" 
ON public.user_roles 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Security Fix 2: Clean up overly broad policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.clients;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.exhibitions;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.exhibition_artworks;