
-- Fix the validate_webdav_token function to address mutability issue
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Hash the provided token and look it up
  SELECT wt.user_id, wt.id, 
         (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > NOW())) as is_valid
  INTO token_record
  FROM public.webdav_tokens wt
  WHERE wt.token_hash = encode(digest(token_text, 'sha256'), 'hex');
  
  IF token_record IS NOT NULL THEN
    -- Update last used timestamp
    UPDATE public.webdav_tokens 
    SET last_used_at = NOW()
    WHERE id = token_record.id;
    
    RETURN QUERY SELECT token_record.user_id, token_record.id, token_record.is_valid;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
  END IF;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO service_role;
