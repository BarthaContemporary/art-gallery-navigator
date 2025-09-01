-- Since we cannot enable RLS on views, we need to recreate them as tables or secure them differently
-- First, let's drop the existing decrypted views and recreate them as secure tables

-- Drop existing decrypted views if they exist
DROP VIEW IF EXISTS public.admin_storage_credentials_decrypted;
DROP VIEW IF EXISTS public.artist_storage_credentials_decrypted; 
DROP VIEW IF EXISTS public.shared_storage_credentials_decrypted;

-- Create secure decrypted tables that are populated by functions with proper RLS
CREATE TABLE public.admin_storage_credentials_decrypted (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL,
  bucket_name TEXT NOT NULL,
  access_key TEXT NOT NULL, -- This will be decrypted
  secret_key TEXT NOT NULL, -- This will be decrypted
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.artist_storage_credentials_decrypted (
  id UUID PRIMARY KEY,
  artist_id UUID NOT NULL,
  bucket_name TEXT NOT NULL,
  access_key TEXT NOT NULL, -- This will be decrypted
  secret_key TEXT NOT NULL, -- This will be decrypted
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.shared_storage_credentials_decrypted (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  access_key TEXT NOT NULL, -- This will be decrypted
  secret_key TEXT NOT NULL, -- This will be decrypted
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on the new tables
ALTER TABLE public.admin_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY;

-- Add strict RLS policies
CREATE POLICY "Admins can only access their own decrypted admin credentials"
ON public.admin_storage_credentials_decrypted
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid());

CREATE POLICY "Artists can only access their own decrypted credentials"
ON public.artist_storage_credentials_decrypted
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.artists a 
  WHERE a.id = artist_storage_credentials_decrypted.artist_id 
  AND a.user_id = auth.uid()
) OR has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.artists a 
  WHERE a.id = artist_storage_credentials_decrypted.artist_id 
  AND a.user_id = auth.uid()
) OR has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Only admins can access shared decrypted credentials"
ON public.shared_storage_credentials_decrypted
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));