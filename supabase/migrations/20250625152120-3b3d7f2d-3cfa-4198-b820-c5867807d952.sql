
-- Create the missing digest function that the validate_webdav_token function needs
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wt.user_id,
    wt.id as token_id,
    (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > now())) as is_valid
  FROM webdav_tokens wt
  WHERE wt.token_hash = encode(digest(token_text, 'sha256'), 'hex')
    AND wt.is_active = true;
  
  -- Update last_used_at if a valid token was found
  UPDATE webdav_tokens 
  SET last_used_at = now()
  WHERE token_hash = encode(digest(token_text, 'sha256'), 'hex')
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO service_role;
