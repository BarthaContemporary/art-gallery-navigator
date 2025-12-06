-- Create a public-safe view for collection_websites that excludes password_hash
CREATE OR REPLACE VIEW public.collection_websites_public_safe
WITH (security_invoker = true)
AS SELECT 
  id,
  collection_id,
  slug,
  name,
  show_prices,
  is_active,
  created_at,
  updated_at,
  -- Expose whether password is required, but not the hash itself
  (password_hash IS NOT NULL) AS requires_password
FROM public.collection_websites;

-- Grant access to the safe view
GRANT SELECT ON public.collection_websites_public_safe TO anon;
GRANT SELECT ON public.collection_websites_public_safe TO authenticated;