-- Clean up duplicate RLS policies on webdav_tokens table
-- Keep the properly named ones, remove duplicates

DROP POLICY IF EXISTS "Users can create their own webdav tokens" ON public.webdav_tokens;
DROP POLICY IF EXISTS "Users can delete their own webdav tokens" ON public.webdav_tokens;
DROP POLICY IF EXISTS "Users can update their own webdav tokens" ON public.webdav_tokens;
DROP POLICY IF EXISTS "Users can view their own webdav tokens" ON public.webdav_tokens;

-- Verify the remaining policies are correct (these should already exist)
-- "Users can create their own WebDAV tokens" - INSERT with (user_id = auth.uid())
-- "Users can delete their own WebDAV tokens" - DELETE with (user_id = auth.uid())
-- "Users can update their own WebDAV tokens" - UPDATE with (user_id = auth.uid())
-- "Users can view their own WebDAV tokens" - SELECT with (user_id = auth.uid())

-- Add admin access policy for webdav_tokens so admins can help users manage tokens if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy 
    WHERE polrelid = 'public.webdav_tokens'::regclass 
    AND polname = 'Admins can view all webdav tokens'
  ) THEN
    CREATE POLICY "Admins can view all webdav tokens"
    ON public.webdav_tokens
    FOR SELECT
    USING (has_role(auth.uid(), 'gallery_admin'::user_role));
  END IF;
END $$;