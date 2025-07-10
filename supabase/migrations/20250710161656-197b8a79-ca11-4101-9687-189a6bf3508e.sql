-- Fix security vulnerability in update_admin_storage_credentials_updated_at function
-- by setting a secure search_path

-- First drop the trigger
DROP TRIGGER IF EXISTS update_admin_storage_credentials_updated_at ON public.admin_storage_credentials;

-- Then drop and recreate the function with secure search_path
DROP FUNCTION IF EXISTS public.update_admin_storage_credentials_updated_at();

CREATE OR REPLACE FUNCTION public.update_admin_storage_credentials_updated_at()
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

-- Recreate the trigger
CREATE TRIGGER update_admin_storage_credentials_updated_at
BEFORE UPDATE ON public.admin_storage_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_admin_storage_credentials_updated_at();