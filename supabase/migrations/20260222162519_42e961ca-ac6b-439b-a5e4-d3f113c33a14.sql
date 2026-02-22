
-- Fix: Restrict publication_download_tokens to admin-only and service role
DROP POLICY IF EXISTS "Authenticated users can manage tokens" ON public.publication_download_tokens;
DROP POLICY IF EXISTS "Anyone can read valid tokens" ON public.publication_download_tokens;

-- Admins can view tokens for management
CREATE POLICY "Admins can view tokens"
ON public.publication_download_tokens
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Admins can manage (update/delete) tokens
CREATE POLICY "Admins can manage tokens"
ON public.publication_download_tokens
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));
