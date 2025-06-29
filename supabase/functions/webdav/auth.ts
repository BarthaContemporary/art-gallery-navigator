
export interface UserInfo {
  user_id: string;
  token_id: string;
}

export async function authenticateUser(supabase: any, authHeader: string, requestId: string): Promise<UserInfo | null> {
  console.log(`[${requestId}] Starting credential parsing...`);
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log(`[${requestId}] Invalid auth header format`);
    return null;
  }

  try {
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    console.log(`[${requestId}] Base64 credentials length: ${base64Credentials.length}`);
    
    // Enhanced decoding with multiple fallback attempts for Mac compatibility
    let decodedCredentials: string;
    try {
      decodedCredentials = atob(base64Credentials);
      console.log(`[${requestId}] Primary decoding successful, length: ${decodedCredentials.length}`);
    } catch (primaryError) {
      console.log(`[${requestId}] Primary decoding failed, trying alternative method`);
      try {
        // Alternative decoding method for Mac Finder edge cases
        const cleanBase64 = base64Credentials.replace(/[^A-Za-z0-9+/]/g, '');
        const uint8Array = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        decodedCredentials = new TextDecoder('utf-8').decode(uint8Array);
        console.log(`[${requestId}] Alternative decoding successful`);
      } catch (altError) {
        console.log(`[${requestId}] All decoding methods failed:`, altError);
        return null;
      }
    }

    const colonIndex = decodedCredentials.indexOf(':');
    if (colonIndex === -1) {
      console.log(`[${requestId}] No colon separator found in credentials`);
      return null;
    }

    const username = decodedCredentials.substring(0, colonIndex).trim();
    const token = decodedCredentials.substring(colonIndex + 1).trim();
    
    console.log(`[${requestId}] Parsed username: "${username}", token length: ${token.length}`);

    // More lenient username validation for Mac Finder compatibility
    const validUsernames = ['webdav', 'WebDAV', '', 'user', 'admin'];
    if (!validUsernames.includes(username)) {
      console.log(`[${requestId}] Username "${username}" not in allowed list, but continuing with token validation`);
    }

    if (!token || token.length < 32) {
      console.log(`[${requestId}] Token too short or missing`);
      return null;
    }

    console.log(`[${requestId}] Validating token with database...`);
    
    const { data: tokenValidation, error: tokenError } = await supabase.rpc('validate_webdav_token', {
      token_text: token
    });

    console.log(`[${requestId}] Token validation response:`, {
      tokenValidation,
      tokenError,
      validationCount: tokenValidation?.length || 0
    });

    if (tokenError) {
      console.error(`[${requestId}] Token validation database error:`, tokenError);
      return null;
    }

    if (!tokenValidation || tokenValidation.length === 0) {
      console.log(`[${requestId}] No token validation results returned`);
      return null;
    }

    const validationResult = tokenValidation[0];
    console.log(`[${requestId}] Validation result:`, validationResult);

    if (!validationResult.is_valid) {
      console.log(`[${requestId}] Token marked as invalid`);
      return null;
    }

    return {
      user_id: validationResult.user_id,
      token_id: validationResult.token_id
    };

  } catch (error) {
    console.error(`[${requestId}] Authentication error:`, error);
    return null;
  }
}
