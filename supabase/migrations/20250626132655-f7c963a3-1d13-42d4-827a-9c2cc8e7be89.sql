
-- Step 1: Fix the validate_webdav_token function with robust error handling and consistent hashing
DROP FUNCTION IF EXISTS public.validate_webdav_token(text);

CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_record RECORD;
  token_hash_value text;
  input_length integer;
BEGIN
  -- Comprehensive input validation and logging
  input_length := LENGTH(COALESCE(token_text, ''));
  RAISE LOG 'validate_webdav_token called with token length: %', input_length;
  
  -- Validate input with detailed logging
  IF token_text IS NULL THEN
    RAISE LOG 'Token validation failed: token is NULL';
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  
  IF LENGTH(trim(token_text)) = 0 THEN
    RAISE LOG 'Token validation failed: token is empty after trim';
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  
  IF input_length != 64 THEN
    RAISE LOG 'Token validation failed: expected 64 characters, got %', input_length;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  
  -- Hash the provided token using EXACT same method as creation function
  -- This matches the JavaScript: encoder.encode(tokenString) -> crypto.subtle.digest('SHA-256', tokenBytes)
  BEGIN
    token_hash_value := encode(digest(token_text::bytea, 'sha256'), 'hex');
    RAISE LOG 'Token hash computed successfully - length: %, sample: %', 
      LENGTH(token_hash_value), LEFT(token_hash_value, 8);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Token hashing failed with error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END;
  
  -- Look up the token with detailed logging
  BEGIN
    SELECT wt.user_id, wt.id, wt.name, wt.is_active, wt.expires_at, wt.token_hash,
           (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > NOW())) as computed_is_valid
    INTO token_record
    FROM public.webdav_tokens wt
    WHERE wt.token_hash = token_hash_value;
    
    IF token_record IS NOT NULL THEN
      RAISE LOG 'Token found: id=%, name=%, is_active=%, expires_at=%, computed_valid=%', 
        token_record.id, token_record.name, token_record.is_active, 
        token_record.expires_at, token_record.computed_is_valid;
      
      -- Update last used timestamp only if token is valid
      IF token_record.computed_is_valid THEN
        BEGIN
          UPDATE public.webdav_tokens 
          SET last_used_at = NOW()
          WHERE id = token_record.id;
          RAISE LOG 'Updated last_used_at for token %', token_record.id;
        EXCEPTION WHEN OTHERS THEN
          RAISE LOG 'Failed to update last_used_at: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
          -- Continue even if update fails
        END;
      ELSE
        RAISE LOG 'Token found but not valid: is_active=%, expires_at=%', 
          token_record.is_active, token_record.expires_at;
      END IF;
      
      RETURN QUERY SELECT token_record.user_id, token_record.id, token_record.computed_is_valid;
    ELSE
      RAISE LOG 'No token found with computed hash: %', LEFT(token_hash_value, 16);
      
      -- Debug: Log existing tokens for comparison
      FOR token_record IN 
        SELECT id, name, LEFT(token_hash, 16) as hash_sample, is_active, expires_at, created_at
        FROM public.webdav_tokens 
        WHERE is_active = true
        ORDER BY created_at DESC 
        LIMIT 3
      LOOP
        RAISE LOG 'Existing active token: id=%, name=%, hash_sample=%, is_active=%, expires_at=%, created_at=%', 
          token_record.id, token_record.name, token_record.hash_sample, 
          token_record.is_active, token_record.expires_at, token_record.created_at;
      END LOOP;
      
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Database lookup failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO service_role;

-- Add helpful indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_webdav_tokens_hash_active ON public.webdav_tokens(token_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webdav_tokens_user_active ON public.webdav_tokens(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webdav_tokens_expires ON public.webdav_tokens(expires_at) WHERE expires_at IS NOT NULL;
