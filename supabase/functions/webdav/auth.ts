
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
    console.log(`[${requestId}] Base64 sample: ${base64Credentials.substring(0, 20)}...`);
    
    // Enhanced decoding with multiple fallback attempts for Mac compatibility
    let decodedCredentials: string;
    try {
      decodedCredentials = atob(base64Credentials);
      console.log(`[${requestId}] Primary decoding successful, length: ${decodedCredentials.length}`);
    } catch (primaryError) {
      console.log(`[${requestId}] Primary decoding failed, trying alternative method`);
      try {
        // Alternative decoding method for Mac Finder edge cases
        const uint8Array = Uint8Array.from(atob(base64Credentials.replace(/[^A-Za-z0-9+/]/g, '')), c => c.charCodeAt(0));
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

    const username = decodedCredentials.substring(0, colonIndex);
    const token = decodedCredentials.substring(colonIndex + 1);
    
    console.log(`[${requestId}] Parsed username: "${username}", token length: ${token.length}`);
    console.log(`[${requestId}] Token sample: ${token.substring(0, 8)}...`);

    // Validate username for Mac compatibility
    if (username !== 'webdav' && username !== 'WebDAV' && username !== '') {
      console.log(`[${requestId}] Invalid username for WebDAV: "${username}"`);
      // Don't immediately fail - some Mac configurations use different usernames
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
