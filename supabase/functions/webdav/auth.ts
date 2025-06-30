
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
    console.log(`[${requestId}] Processing credentials...`);
    
    let decodedCredentials: string;
    try {
      // Primary decoding with enhanced Mac compatibility
      const cleanBase64 = base64Credentials.trim().replace(/[^A-Za-z0-9+/=]/g, '');
      const padding = cleanBase64.length % 4;
      const paddedBase64 = cleanBase64 + '='.repeat(padding ? 4 - padding : 0);
      
      decodedCredentials = atob(paddedBase64);
      console.log(`[${requestId}] Credentials decoded successfully`);
    } catch (decodeError) {
      console.log(`[${requestId}] Decoding failed:`, decodeError);
      return null;
    }

    const colonIndex = decodedCredentials.indexOf(':');
    if (colonIndex === -1) {
      console.log(`[${requestId}] No colon separator found`);
      return null;
    }

    const username = decodedCredentials.substring(0, colonIndex).trim();
    const token = decodedCredentials.substring(colonIndex + 1).trim();
    
    console.log(`[${requestId}] Username: "${username}", token length: ${token.length}`);

    // Very permissive username validation for Mac Finder
    const allowedUsernames = ['webdav', 'WebDAV', 'WEBDAV', '', 'user', 'admin', 'dav'];
    const usernameValid = allowedUsernames.includes(username) || username.toLowerCase().includes('webdav');
    
    if (!usernameValid) {
      console.log(`[${requestId}] Username "${username}" not recognized, but continuing...`);
    }

    if (!token || token.length < 32) {
      console.log(`[${requestId}] Token validation failed: length ${token.length}`);
      return null;
    }

    // Enhanced token validation with better error handling
    console.log(`[${requestId}] Validating token with database...`);
    
    const { data: tokenValidation, error: tokenError } = await supabase.rpc('validate_webdav_token', {
      token_text: token
    });

    if (tokenError) {
      console.error(`[${requestId}] Token validation error:`, tokenError);
      return null;
    }

    if (!tokenValidation || tokenValidation.length === 0) {
      console.log(`[${requestId}] No matching token found in database`);
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

    return {
      user_id: result.user_id,
      token_id: result.token_id
    };

  } catch (error) {
    console.error(`[${requestId}] Authentication error:`, error);
    return null;
  }
}
