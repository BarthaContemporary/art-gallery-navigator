-- Add policy to allow all authenticated users to read shared storage credentials
CREATE POLICY "All users can view shared storage credentials"
ON public.shared_storage_credentials
FOR SELECT
USING (true);