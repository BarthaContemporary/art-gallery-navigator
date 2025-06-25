
-- Fix the validate_webdav_token function to properly handle null values and edge cases
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_record RECORD;
  token_hash_value text;
BEGIN
  -- Validate input
  IF token_text IS NULL OR LENGTH(trim(token_text)) = 0 THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  
  -- Hash the provided token
  BEGIN
    token_hash_value := encode(digest(token_text, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    -- If hashing fails, return invalid
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END;
  
  -- Look up the token
  SELECT wt.user_id, wt.id, 
         (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > NOW())) as is_valid
  INTO token_record
  FROM public.webdav_tokens wt
  WHERE wt.token_hash = token_hash_value;
  
  IF token_record IS NOT NULL THEN
    -- Update last used timestamp only if token is valid
    IF token_record.is_valid THEN
      BEGIN
        UPDATE public.webdav_tokens 
        SET last_used_at = NOW()
        WHERE id = token_record.id;
      EXCEPTION WHEN OTHERS THEN
        -- Continue even if update fails
        NULL;
      END;
    END IF;
    
    RETURN QUERY SELECT token_record.user_id, token_record.id, token_record.is_valid;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
  END IF;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO service_role;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webdav_tokens_hash ON public.webdav_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_webdav_tokens_user_active ON public.webdav_tokens(user_id, is_active);
