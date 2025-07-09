-- Create table to store IDrive e2 credentials for each artist
CREATE TABLE public.artist_storage_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  bucket_name TEXT NOT NULL,
  access_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(artist_id)
);

-- Enable RLS
ALTER TABLE public.artist_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can manage credentials
CREATE POLICY "Admins can manage artist storage credentials"
ON public.artist_storage_credentials
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Artists can view their own credentials (for API access)
CREATE POLICY "Artists can view their own storage credentials"
ON public.artist_storage_credentials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.artists 
    WHERE artists.id = artist_storage_credentials.artist_id 
    AND artists.user_id = auth.uid()
  )
);