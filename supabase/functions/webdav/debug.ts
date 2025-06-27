
import { parseCredentials } from "./auth.ts";
import { getWebDAVResponseHeaders } from "./headers.ts";

// Enhanced debug endpoint with proper CORS
export async function handleDebugToken(req: Request, requestId: string) {
  console.log(`[${requestId}] === DEBUG TOKEN ENDPOINT ===`);
  
  const authHeader = req.headers.get('Authorization');
  const result: any = {
    timestamp: new Date().toISOString(),
    requestId,
    authHeaderPresent: !!authHeader,
    userAgent: req.headers.get('User-Agent') || 'unknown',
    success: false
  };

  if (!authHeader) {
    result.error = 'No Authorization header provided';
    result.expectedFormat = 'Authorization: Basic <base64-encoded-credentials>';
    result.instructions = {
      username: 'webdav',
      password: 'Your 64-character WebDAV token',
      note: 'Make sure your token is exactly 64 hexadecimal characters'
    };
    return new Response(JSON.stringify(result, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getWebDAVResponseHeaders() }
    });
  }

  if (!authHeader.startsWith('Basic ')) {
    result.error = 'Invalid auth type - expected Basic';
    result.received = authHeader.substring(0, 20) + '...';
    return new Response(JSON.stringify(result, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getWebDAVResponseHeaders() }
    });
  }

  const credentials = parseCredentials(authHeader, requestId);
  if (!credentials) {
    result.error = 'Failed to parse credentials';
    result.base64Sample = authHeader.slice(6).substring(0, 20) + '...';
    result.troubleshooting = [
      'Ensure your token is exactly 64 characters long',
      'Verify your token contains only hexadecimal characters (0-9, a-f)',
      'Make sure you are using "webdav" as the username',
      'Try copying the token again from the interface'
    ];
    return new Response(JSON.stringify(result, null, 2), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...getWebDAVResponseHeaders() }
    });
  }

  // Test token hash computation
  const encoder = new TextEncoder();
  const tokenBytes = encoder.encode(credentials.token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
  const hashArray = new Uint8Array(hashBuffer);
  const computedHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');

  result.success = true;
  result.credentials = {
    username: credentials.username,
    tokenLength: credentials.token.length,
    tokenSample: credentials.token.substring(0, 8) + '...',
    tokenIsValidHex: /^[a-f0-9]+$/i.test(credentials.token)
  };
  result.hash = {
    computedHashLength: computedHash.length,
    computedHashSample: computedHash.substring(0, 16) + '...'
  };

  // Test database connection
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      result.error = 'Server configuration error - missing environment variables';
      return new Response(JSON.stringify(result, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getWebDAVResponseHeaders() }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: tokenValidation, error: tokenError } = await supabase
      .rpc('validate_webdav_token', { token_text: credentials.token });

    if (tokenError) {
      result.error = 'Token validation failed';
      result.dbError = tokenError.message;
    } else if (!tokenValidation || tokenValidation.length === 0) {
      result.error = 'Token not found in database';
      result.note = 'This token may have been deleted or never created';
    } else {
      const validation = tokenValidation[0];
      result.tokenValid = validation.is_valid;
      result.userId = validation.user_id;
      result.tokenId = validation.token_id;
      
      if (validation.is_valid) {
        result.message = 'Token is valid and authentication should work';
      } else {
        result.error = 'Token exists but is not valid (expired or deactivated)';
      }
    }
  } catch (dbError) {
    result.error = 'Database connection failed';
    result.dbError = dbError.message;
  }

  return new Response(JSON.stringify(result, null, 2), {
    status: result.success && result.tokenValid ? 200 : 400,
    headers: { 'Content-Type': 'application/json', ...getWebDAVResponseHeaders() }
  });
}
