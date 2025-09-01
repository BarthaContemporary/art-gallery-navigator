-- Fix storage credentials security vulnerability
-- Add RLS policies to decrypted storage credential views

-- Enable RLS on admin storage credentials decrypted view
ALTER TABLE public.admin_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for admin storage credentials - only admins can access their own credentials
CREATE POLICY "Admins can only access their own decrypted storage credentials"
ON public.admin_storage_credentials_decrypted
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role) AND user_id = auth.uid());

-- Enable RLS on artist storage credentials decrypted view
ALTER TABLE public.artist_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for artist storage credentials - only artists can access their own credentials
CREATE POLICY "Artists can only access their own decrypted storage credentials"
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

-- Enable RLS on shared storage credentials decrypted view (if it exists)
-- First check if the table exists and enable RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shared_storage_credentials_decrypted') THEN
    EXECUTE 'ALTER TABLE public.shared_storage_credentials_decrypted ENABLE ROW LEVEL SECURITY';
    
    -- Add RLS policy for shared storage credentials - only admins can access
    EXECUTE 'CREATE POLICY "Only admins can access shared decrypted storage credentials"
    ON public.shared_storage_credentials_decrypted
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), ''gallery_admin''::user_role))
    WITH CHECK (has_role(auth.uid(), ''gallery_admin''::user_role))';
  END IF;
END $$;