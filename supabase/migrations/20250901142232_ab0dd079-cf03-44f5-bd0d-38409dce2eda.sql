-- Create secure functions to populate the decrypted tables on demand
-- These functions will only return data to authorized users

CREATE OR REPLACE FUNCTION public.get_admin_storage_credentials_decrypted()
RETURNS SETOF public.admin_storage_credentials_decrypted
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Clear any existing data and repopulate with current user's credentials
  DELETE FROM public.admin_storage_credentials_decrypted WHERE user_id = auth.uid();
  
  INSERT INTO public.admin_storage_credentials_decrypted (
    id, name, user_id, bucket_name, access_key, secret_key, 
    endpoint_url, region, is_active, created_at, updated_at
  )
  SELECT 
    ac.id,
    ac.name,
    ac.user_id,
    ac.bucket_name,
    decrypt_credential(ac.access_key) as access_key,
    decrypt_credential(ac.secret_key) as secret_key,
    ac.endpoint_url,
    ac.region,
    ac.is_active,
    ac.created_at,
    ac.updated_at
  FROM public.admin_storage_credentials ac
  WHERE ac.user_id = auth.uid();
  
  RETURN QUERY 
  SELECT * FROM public.admin_storage_credentials_decrypted 
  WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_artist_storage_credentials_decrypted(p_artist_id UUID DEFAULT NULL)
RETURNS SETOF public.artist_storage_credentials_decrypted
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_artist_id UUID;
BEGIN
  -- If artist_id is provided, use it; otherwise find current user's artist
  IF p_artist_id IS NOT NULL THEN
    target_artist_id := p_artist_id;
    -- Verify user has access to this artist
    IF NOT (has_role(auth.uid(), 'gallery_admin'::user_role) OR 
            EXISTS(SELECT 1 FROM public.artists WHERE id = target_artist_id AND user_id = auth.uid())) THEN
      RAISE EXCEPTION 'Access denied: Not authorized for this artist';
    END IF;
  ELSE
    -- Find current user's artist
    SELECT id INTO target_artist_id FROM public.artists WHERE user_id = auth.uid() LIMIT 1;
    IF target_artist_id IS NULL THEN
      RETURN; -- No artist found for user
    END IF;
  END IF;
  
  -- Clear any existing data and repopulate
  DELETE FROM public.artist_storage_credentials_decrypted WHERE artist_id = target_artist_id;
  
  INSERT INTO public.artist_storage_credentials_decrypted (
    id, artist_id, bucket_name, access_key, secret_key, 
    endpoint_url, region, created_at, updated_at
  )
  SELECT 
    ac.id,
    ac.artist_id,
    ac.bucket_name,
    decrypt_credential(ac.access_key) as access_key,
    decrypt_credential(ac.secret_key) as secret_key,
    ac.endpoint_url,
    ac.region,
    ac.created_at,
    ac.updated_at
  FROM public.artist_storage_credentials ac
  WHERE ac.artist_id = target_artist_id;
  
  RETURN QUERY 
  SELECT * FROM public.artist_storage_credentials_decrypted 
  WHERE artist_id = target_artist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_storage_credentials_decrypted()
RETURNS SETOF public.shared_storage_credentials_decrypted
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Clear and repopulate
  DELETE FROM public.shared_storage_credentials_decrypted;
  
  INSERT INTO public.shared_storage_credentials_decrypted (
    id, name, bucket_name, access_key, secret_key, 
    endpoint_url, region, is_active, created_at, updated_at
  )
  SELECT 
    sc.id,
    sc.name,
    sc.bucket_name,
    decrypt_credential(sc.access_key) as access_key,
    decrypt_credential(sc.secret_key) as secret_key,
    sc.endpoint_url,
    sc.region,
    sc.is_active,
    sc.created_at,
    sc.updated_at
  FROM public.shared_storage_credentials sc
  WHERE sc.is_active = true;
  
  RETURN QUERY 
  SELECT * FROM public.shared_storage_credentials_decrypted;
END;
$$;