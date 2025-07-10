-- Create admin storage credentials table
CREATE TABLE public.admin_storage_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  access_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for admin storage credentials
CREATE POLICY "Admins can manage their own admin storage credentials"
ON public.admin_storage_credentials
FOR ALL
USING (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid());

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_admin_storage_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_storage_credentials_updated_at
  BEFORE UPDATE ON public.admin_storage_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_storage_credentials_updated_at();