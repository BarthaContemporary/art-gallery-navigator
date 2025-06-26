
-- Fix the validate_webdav_token function to properly handle token hashing
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
  -- Log the input for debugging
  RAISE LOG 'validate_webdav_token called with token length: %', LENGTH(COALESCE(token_text, ''));
  
  -- Validate input
  IF token_text IS NULL OR LENGTH(trim(token_text)) = 0 THEN
    RAISE LOG 'Token is null or empty';
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  
  -- Hash the provided token using pgcrypto - convert text to bytea first
  BEGIN
    token_hash_value := encode(digest(token_text::bytea, 'sha256'), 'hex');
    RAISE LOG 'Computed hash length: %, sample: %', LENGTH(token_hash_value), LEFT(token_hash_value, 8);
  EXCEPTION WHEN OTHERS THEN
    -- If hashing fails, return invalid
    RAISE LOG 'Failed to hash token: %', SQLERRM;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END;
  
  -- Look up the token
  SELECT wt.user_id, wt.id, wt.name, wt.is_active, wt.expires_at, wt.token_hash,
         (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > NOW())) as is_valid
  INTO token_record
  FROM public.webdav_tokens wt
  WHERE wt.token_hash = token_hash_value;
  
  IF token_record IS NOT NULL THEN
    RAISE LOG 'Found token: id=%, name=%, is_active=%, expires_at=%, computed_valid=%', 
      token_record.id, token_record.name, token_record.is_active, token_record.expires_at, token_record.is_valid;
    
    -- Update last used timestamp only if token is valid
    IF token_record.is_valid THEN
      BEGIN
        UPDATE public.webdav_tokens 
        SET last_used_at = NOW()
        WHERE id = token_record.id;
        RAISE LOG 'Updated last_used_at for token %', token_record.id;
      EXCEPTION WHEN OTHERS THEN
        -- Continue even if update fails
        RAISE LOG 'Failed to update last_used_at: %', SQLERRM;
      END;
    END IF;
    
    RETURN QUERY SELECT token_record.user_id, token_record.id, token_record.is_valid;
  ELSE
    RAISE LOG 'No token found with computed hash';
    -- Let's also check what tokens exist for debugging
    FOR token_record IN 
      SELECT id, name, LEFT(token_hash, 8) as hash_sample, is_active, expires_at 
      FROM public.webdav_tokens 
      ORDER BY created_at DESC 
      LIMIT 5
    LOOP
      RAISE LOG 'Existing token: id=%, name=%, hash_sample=%, is_active=%, expires_at=%', 
        token_record.id, token_record.name, token_record.hash_sample, token_record.is_active, token_record.expires_at;
    END LOOP;
    
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
  END IF;
END;
$$;
