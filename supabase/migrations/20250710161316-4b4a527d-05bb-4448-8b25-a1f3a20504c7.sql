-- Fix security vulnerability in update_shared_storage_credentials_updated_at function
-- by setting a secure search_path
DROP FUNCTION IF EXISTS public.update_shared_storage_credentials_updated_at();

CREATE OR REPLACE FUNCTION public.update_shared_storage_credentials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;