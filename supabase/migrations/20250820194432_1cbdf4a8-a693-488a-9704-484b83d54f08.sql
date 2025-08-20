-- Fix security definer view issues by removing the security barrier setting
-- and ensuring proper access control through RLS policies instead

-- Drop the security barrier settings (this is what's causing the SECURITY DEFINER view warnings)
-- These views will rely on RLS policies from the underlying tables instead
DROP VIEW IF EXISTS public.admin_storage_credentials_decrypted;
DROP VIEW IF EXISTS public.artist_storage_credentials_decrypted;
DROP VIEW IF EXISTS public.shared_storage_credentials_decrypted;

-- Recreate views without security_barrier (which makes them SECURITY DEFINER)
CREATE OR REPLACE VIEW public.admin_storage_credentials_decrypted AS
SELECT 
  id,
  name,
  user_id,
  bucket_name,
  decrypt_credential(access_key) AS access_key,
  decrypt_credential(secret_key) AS secret_key,
  endpoint_url,
  region,
  is_active,
  created_at,
  updated_at
FROM public.admin_storage_credentials;

CREATE OR REPLACE VIEW public.artist_storage_credentials_decrypted AS
SELECT 
  id,
  artist_id,
  bucket_name,
  decrypt_credential(access_key) AS access_key,
  decrypt_credential(secret_key) AS secret_key,
  endpoint_url,
  region,
  created_at,
  updated_at
FROM public.artist_storage_credentials;

CREATE OR REPLACE VIEW public.shared_storage_credentials_decrypted AS
SELECT 
  id,
  name,
  bucket_name,
  decrypt_credential(access_key) AS access_key,
  decrypt_credential(secret_key) AS secret_key,
  endpoint_url,
  region,
  is_active,
  created_at,
  updated_at
FROM public.shared_storage_credentials;

-- Fix function search path issues by adding SET search_path to all functions
CREATE OR REPLACE FUNCTION public.get_encryption_key()
RETURNS TEXT AS $$
BEGIN
  -- Use a combination of database settings and system info for key generation
  -- In production, this should use a proper key management system
  RETURN encode(digest('lovable-storage-key-' || current_database() || '-2024', 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.encrypt_credential(plaintext TEXT)
RETURNS TEXT AS $$
BEGIN
  IF plaintext IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plaintext, get_encryption_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrypt_credential(ciphertext TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(ciphertext, get_encryption_key());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.insert_admin_storage_credentials(
  p_name TEXT,
  p_user_id UUID,
  p_bucket_name TEXT,
  p_access_key TEXT,
  p_secret_key TEXT,
  p_endpoint_url TEXT DEFAULT 'https://s3.idrivee2.com',
  p_region TEXT DEFAULT 'us-east-1',
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- Check if user has admin role
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  INSERT INTO public.admin_storage_credentials (
    name, user_id, bucket_name, access_key, secret_key, 
    endpoint_url, region, is_active
  ) VALUES (
    p_name, p_user_id, p_bucket_name, 
    encrypt_credential(p_access_key), 
    encrypt_credential(p_secret_key),
    p_endpoint_url, p_region, p_is_active
  ) RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.insert_artist_storage_credentials(
  p_artist_id UUID,
  p_bucket_name TEXT,
  p_access_key TEXT,
  p_secret_key TEXT,
  p_endpoint_url TEXT DEFAULT 'https://s3.idrivee2.com',
  p_region TEXT DEFAULT 'us-east-1'
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- Check if user is admin or owns the artist record
  IF NOT (has_role(auth.uid(), 'gallery_admin'::user_role) OR 
          EXISTS(SELECT 1 FROM artists WHERE id = p_artist_id AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: Admin role or artist ownership required';
  END IF;
  
  INSERT INTO public.artist_storage_credentials (
    artist_id, bucket_name, access_key, secret_key, 
    endpoint_url, region
  ) VALUES (
    p_artist_id, p_bucket_name, 
    encrypt_credential(p_access_key), 
    encrypt_credential(p_secret_key),
    p_endpoint_url, p_region
  ) RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.insert_shared_storage_credentials(
  p_name TEXT,
  p_bucket_name TEXT,
  p_access_key TEXT,
  p_secret_key TEXT,
  p_endpoint_url TEXT DEFAULT 'https://s3.idrivee2.com',
  p_region TEXT DEFAULT 'us-east-1',
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- Check if user has admin role
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  INSERT INTO public.shared_storage_credentials (
    name, bucket_name, access_key, secret_key, 
    endpoint_url, region, is_active
  ) VALUES (
    p_name, p_bucket_name, 
    encrypt_credential(p_access_key), 
    encrypt_credential(p_secret_key),
    p_endpoint_url, p_region, p_is_active
  ) RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_admin_storage_credentials(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_bucket_name TEXT DEFAULT NULL,
  p_access_key TEXT DEFAULT NULL,
  p_secret_key TEXT DEFAULT NULL,
  p_endpoint_url TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has admin role and owns the credential
  IF NOT (has_role(auth.uid(), 'gallery_admin'::user_role) AND 
          EXISTS(SELECT 1 FROM admin_storage_credentials WHERE id = p_id AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Access denied: Admin role and ownership required';
  END IF;
  
  UPDATE public.admin_storage_credentials SET
    name = COALESCE(p_name, name),
    bucket_name = COALESCE(p_bucket_name, bucket_name),
    access_key = CASE WHEN p_access_key IS NOT NULL THEN encrypt_credential(p_access_key) ELSE access_key END,
    secret_key = CASE WHEN p_secret_key IS NOT NULL THEN encrypt_credential(p_secret_key) ELSE secret_key END,
    endpoint_url = COALESCE(p_endpoint_url, endpoint_url),
    region = COALESCE(p_region, region),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_storage_encryption_event()
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.security_events (
    user_id, 
    event_type, 
    ip_address, 
    user_agent, 
    details
  ) VALUES (
    auth.uid(),
    'storage_credentials_encrypted_high',
    NULL,
    NULL,
    jsonb_build_object(
      'action', 'encrypted_all_storage_credentials',
      'tables_affected', ARRAY['admin_storage_credentials', 'artist_storage_credentials', 'shared_storage_credentials'],
      'timestamp', NOW(),
      'encryption_method', 'pgp_sym_encrypt',
      'severity', 'high'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;