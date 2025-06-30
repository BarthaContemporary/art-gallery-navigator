
export interface UserInfo {
  user_id: string;
  token_id: string;
}

export async function authenticateUser(supabase: any, authHeader: string, requestId: string): Promise<UserInfo | null> {
  console.log(`[${requestId}] Starting authentication...`);
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log(`[${requestId}] Missing or invalid auth header format`);
    return null;
  }

  try {
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    console.log(`[${requestId}] Processing credentials (length: ${base64Credentials.length})...`);
    
    let decodedCredentials: string;
    try {
      // Enhanced decoding with better Mac compatibility
      const cleanBase64 = base64Credentials.trim().replace(/[^A-Za-z0-9+/=]/g, '');
      const padding = cleanBase64.length % 4;
      const paddedBase64 = cleanBase64 + '='.repeat(padding ? 4 - padding : 0);
      
      decodedCredentials = atob(paddedBase64);
      console.log(`[${requestId}] Credentials decoded successfully (length: ${decodedCredentials.length})`);
    } catch (decodeError) {
      console.log(`[${requestId}] Decoding failed:`, decodeError);
      return null;
    }

    const colonIndex = decodedCredentials.indexOf(':');
    if (colonIndex === -1) {
      console.log(`[${requestId}] No colon separator found in credentials`);
      return null;
    }

    const username = decodedCredentials.substring(0, colonIndex).trim();
    const token = decodedCredentials.substring(colonIndex + 1).trim();
    
    console.log(`[${requestId}] Username: "${username}", token length: ${token.length}`);
    console.log(`[${requestId}] Token preview: ${token.substring(0, 8)}...${token.substring(token.length - 8)}`);

    // Very permissive username validation for Mac Finder compatibility
    const allowedUsernames = ['webdav', 'WebDAV', 'WEBDAV', '', 'user', 'admin', 'dav'];
    const usernameValid = allowedUsernames.includes(username) || username.toLowerCase().includes('webdav');
    
    if (!usernameValid) {
      console.log(`[${requestId}] Username "${username}" not in allowed list, but continuing for Mac compatibility...`);
    }

    if (!token || token.length < 32) {
      console.log(`[${requestId}] Token validation failed: invalid length ${token.length}`);
      return null;
    }

    // Enhanced token validation with comprehensive logging
    console.log(`[${requestId}] Validating token with database...`);
    
    // First, let's check if there are any active tokens at all
    const { data: allTokens, error: allTokensError } = await supabase
      .from('webdav_tokens')
      .select('id, user_id, name, token_hash, is_active, expires_at, created_at')
      .eq('is_active', true);

    if (allTokensError) {
      console.error(`[${requestId}] Error fetching all tokens:`, allTokensError);
      return null;
    }

    console.log(`[${requestId}] Found ${allTokens?.length || 0} active tokens in database`);
    if (allTokens && allTokens.length > 0) {
      allTokens.forEach((t, index) => {
        console.log(`[${requestId}] Token ${index + 1}: ID=${t.id}, hash=${t.token_hash?.substring(0, 8)}..., active=${t.is_active}, expires=${t.expires_at}`);
      });
    }

    // Now validate the specific token
    const { data: tokenValidation, error: tokenError } = await supabase.rpc('validate_webdav_token', {
      token_text: token
    });

    if (tokenError) {
      console.error(`[${requestId}] Token validation RPC error:`, tokenError);
      return null;
    }

    if (!tokenValidation || tokenValidation.length === 0) {
      console.log(`[${requestId}] No matching token found in database for provided token`);
      
      // Let's try to compute the hash manually for debugging
      try {
        const encoder = new TextEncoder();
        const tokenBytes = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
        const hashArray = new Uint8Array(hashBuffer);
        const computedHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
        console.log(`[${requestId}] Computed hash for token: ${computedHash.substring(0, 16)}...`);
        
        // Check if this hash exists in our tokens
        const matchingToken = allTokens?.find(t => t.token_hash === computedHash);
        if (matchingToken) {
          console.log(`[${requestId}] Found matching token by manual hash: ${matchingToken.id}`);
        } else {
          console.log(`[${requestId}] No matching token found even with manual hash computation`);
        }
      } catch (hashError) {
        console.error(`[${requestId}] Manual hash computation failed:`, hashError);
      }
      
      return null;
    }

    const result = tokenValidation[0];
    console.log(`[${requestId}] Token validation result:`, { 
      user_id: result.user_id, 
      token_id: result.token_id, 
      is_valid: result.is_valid 
    });

    if (!result.is_valid) {
      console.log(`[${requestId}] Token marked as invalid or expired`);
      return null;
    }

    // Update last_used_at for the token
    await supabase
      .from('webdav_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', result.token_id);

    console.log(`[${requestId}] Authentication successful for user: ${result.user_id}`);
    return {
      user_id: result.user_id,
      token_id: result.token_id
    };

  } catch (error) {
    console.error(`[${requestId}] Authentication error:`, error);
    return null;
  }
}
