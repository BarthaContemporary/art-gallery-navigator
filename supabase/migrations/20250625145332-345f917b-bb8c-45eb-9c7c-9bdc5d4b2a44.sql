
-- Enable RLS on webdav_tokens table and create policies
ALTER TABLE public.webdav_tokens ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own tokens
CREATE POLICY "Users can view their own webdav tokens" 
  ON public.webdav_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy to allow users to create their own tokens
CREATE POLICY "Users can create their own webdav tokens" 
  ON public.webdav_tokens 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy to allow users to update their own tokens (for deactivation)
CREATE POLICY "Users can update their own webdav tokens" 
  ON public.webdav_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy to allow users to delete their own tokens
CREATE POLICY "Users can delete their own webdav tokens" 
  ON public.webdav_tokens 
  FOR DELETE 
  USING (auth.uid() = user_id);
