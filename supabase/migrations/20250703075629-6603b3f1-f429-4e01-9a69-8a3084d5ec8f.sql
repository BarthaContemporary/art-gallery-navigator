-- Update validate_webdav_token to use extensions.digest consistently
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    computed_hash text;
    token_record RECORD;
BEGIN
    -- Log the token validation attempt  
    RAISE LOG 'validate_webdav_token called with token length: %', length(token_text);
    
    -- Compute hash using the crypto extension's digest function
    BEGIN
        computed_hash := encode(extensions.digest(token_text::bytea, 'sha256'), 'hex');
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Token hashing failed with error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
        RETURN;
    END;
    
    -- Find matching active token
    SELECT 
        wt.user_id,
        wt.id as token_id,
        CASE 
            WHEN wt.id IS NOT NULL 
                 AND wt.is_active = true 
                 AND (wt.expires_at IS NULL OR wt.expires_at > now()) 
            THEN true 
            ELSE false 
        END as is_valid
    INTO token_record
    FROM webdav_tokens wt
    WHERE wt.token_hash = computed_hash
    LIMIT 1;
    
    -- Update last used timestamp if token found and valid
    IF token_record.token_id IS NOT NULL AND token_record.is_valid THEN
        UPDATE webdav_tokens 
        SET last_used_at = now()
        WHERE id = token_record.token_id;
    END IF;
    
    -- Return result
    IF token_record IS NOT NULL THEN
        RETURN QUERY SELECT token_record.user_id, token_record.token_id, token_record.is_valid;
    ELSE
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    END IF;
END;
$$;