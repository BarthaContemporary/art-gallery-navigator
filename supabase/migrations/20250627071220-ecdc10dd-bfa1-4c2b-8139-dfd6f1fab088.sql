
-- Fix the validate_webdav_token function to use the correct hashing method
-- This matches exactly what the webdav-create-token function uses
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    computed_hash text;
BEGIN
    -- Log the token validation attempt
    RAISE LOG 'validate_webdav_token called with token length: %', length(token_text);
    
    -- Compute hash using the same method as the token creation function
    -- This uses the crypto extension's digest function with proper casting
    BEGIN
        computed_hash := encode(extensions.digest(token_text::bytea, 'sha256'), 'hex');
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Token hashing failed with error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
        -- Return invalid result if hashing fails
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
        RETURN;
    END;
    
    -- Find matching active token
    RETURN QUERY
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
    FROM webdav_tokens wt
    WHERE wt.token_hash = computed_hash
    LIMIT 1;
    
    -- If no token found, return invalid result
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_webdav_token(text) TO service_role;
