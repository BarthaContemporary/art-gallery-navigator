
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface UserInfo {
  user_id: string;
  token_id: string;
  is_admin: boolean;
}

// Enhanced credential parsing for Mac Finder compatibility
export function parseCredentials(authHeader: string, requestId: string): { username: string; token: string } | null {
  console.log(`[${requestId}] Starting credential parsing...`);
  
  if (!authHeader.startsWith('Basic ')) {
    console.log(`[${requestId}] Not a Basic auth header`);
    return null;
  }

  const base64Credentials = authHeader.slice(6).trim();
  console.log(`[${requestId}] Base64 credentials length: ${base64Credentials.length}`);
  console.log(`[${requestId}] Base64 sample: ${base64Credentials.substring(0, 20)}...`);

  let credentials: string;
  
  try {
    // Primary decoding method
    credentials = atob(base64Credentials);
    console.log(`[${requestId}] Primary decoding successful, length: ${credentials.length}`);
  } catch (primaryError) {
    console.log(`[${requestId}] Primary decoding failed: ${primaryError.message}`);
    
    try {
      // Alternative decoding for Mac compatibility
      const decoder = new TextDecoder('utf-8');
      const bytes = new Uint8Array(atob(base64Credentials).split('').map(c => c.charCodeAt(0)));
      credentials = decoder.decode(bytes);
      console.log(`[${requestId}] Alternative decoding successful, length: ${credentials.length}`);
    } catch (altError) {
      console.log(`[${requestId}] Alternative decoding failed: ${altError.message}`);
      return null;
    }
  }

  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) {
    console.log(`[${requestId}] No colon separator found in credentials`);
    return null;
  }

  const username = credentials.substring(0, colonIndex);
  const token = credentials.substring(colonIndex + 1);
  
  console.log(`[${requestId}] Parsed username: "${username}", token length: ${token.length}`);
  console.log(`[${requestId}] Token sample: ${token.substring(0, 8)}...`);

  // Enhanced token validation and cleanup
  let cleanToken = token.trim();
  
  // Handle Mac Finder sending URLs instead of tokens
  if (cleanToken.startsWith('http://') || cleanToken.startsWith('https://')) {
    console.log(`[${requestId}] Token appears to be a URL, this is a Mac Finder authentication issue`);
    return null;
  }

  // Check if token is valid hex and correct length
  if (cleanToken.length !== 64) {
    console.log(`[${requestId}] Invalid token length: expected 64, got ${cleanToken.length}`);
    return null;
  }

  if (!/^[a-f0-9]+$/i.test(cleanToken)) {
    console.log(`[${requestId}] Token contains invalid characters - expected hex only`);
    return null;
  }

  return { username, token: cleanToken };
}

export async function authenticateUser(supabase: any, authHeader: string, requestId: string): Promise<UserInfo | null> {
  if (!authHeader) {
    console.log(`[${requestId}] No auth header provided`);
    return null;
  }

  const credentials = parseCredentials(authHeader, requestId);
  if (!credentials) {
    console.log(`[${requestId}] Failed to parse credentials`);
    return null;
  }

  console.log(`[${requestId}] Validating token with database...`);
  
  const { data: tokenValidation, error: tokenError } = await supabase
    .rpc('validate_webdav_token', { token_text: credentials.token });

  console.log(`[${requestId}] Token validation response:`, { 
    tokenValidation, 
    tokenError,
    validationCount: tokenValidation?.length || 0
  });

  if (tokenError) {
    console.error(`[${requestId}] Token validation RPC error:`, tokenError);
    return null;
  }

  if (!tokenValidation || tokenValidation.length === 0) {
    console.log(`[${requestId}] No validation result - token not found`);
    return null;
  }

  const validationResult = tokenValidation[0];
  console.log(`[${requestId}] Validation result:`, validationResult);
  
  if (!validationResult.is_valid) {
    console.log(`[${requestId}] Token validation failed: token is not valid`);
    return null;
  }

  if (!validationResult.user_id || !validationResult.token_id) {
    console.log(`[${requestId}] Invalid validation result: missing user_id or token_id`);
    return null;
  }

  return {
    user_id: validationResult.user_id,
    token_id: validationResult.token_id,
    is_admin: false
  };
}
