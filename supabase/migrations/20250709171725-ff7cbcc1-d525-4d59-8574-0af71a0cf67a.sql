-- Create shared storage credentials table
CREATE TABLE public.shared_storage_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  access_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'us-east-1',
  endpoint_url TEXT NOT NULL DEFAULT 'https://s3.idrivee2.com',
  bucket_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.shared_storage_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for admins only
CREATE POLICY "Admins can manage shared storage credentials" 
ON public.shared_storage_credentials 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_shared_storage_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_shared_storage_credentials_updated_at
BEFORE UPDATE ON public.shared_storage_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_shared_storage_credentials_updated_at();