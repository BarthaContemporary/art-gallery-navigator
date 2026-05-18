
CREATE TABLE IF NOT EXISTS public.inventory_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_api_keys_hash ON public.inventory_api_keys(key_hash);

ALTER TABLE public.inventory_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gallery admins manage api keys" ON public.inventory_api_keys;
CREATE POLICY "Gallery admins manage api keys"
ON public.inventory_api_keys
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gallery_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'gallery_admin')
);

DROP TRIGGER IF EXISTS inventory_api_keys_updated_at ON public.inventory_api_keys;
CREATE TRIGGER inventory_api_keys_updated_at
BEFORE UPDATE ON public.inventory_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_inventory_api_key(_key_hash TEXT)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.inventory_api_keys k
  SET last_used_at = now(), request_count = k.request_count + 1
  WHERE k.key_hash = _key_hash AND k.is_active = true
  RETURNING k.id, k.name;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_inventory_api_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_inventory_api_key(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.artists_public_inventory
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.full_name,
  a.biography,
  a.nationality,
  a.birth_year,
  a.death_year,
  a.place_of_birth,
  a.place_of_death,
  a.image_url,
  a.created_at,
  a.updated_at
FROM public.artists a;

GRANT SELECT ON public.artists_public_inventory TO anon, authenticated;
