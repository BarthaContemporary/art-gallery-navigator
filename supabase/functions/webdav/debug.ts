
import { getWebDAVResponseHeaders } from "./headers.ts";

export async function handleDebugToken(req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] Debug token endpoint called`);
  
  const authHeader = req.headers.get('Authorization');
  console.log(`[${requestId}] Debug - Auth header present: ${!!authHeader}`);
  
  let tokenInfo = null;
  let debugDetails = {
    hasAuthHeader: !!authHeader,
    authHeaderLength: authHeader?.length || 0,
    decoded: null as any,
    hashComputed: null as string | null,
    error: null as string | null
  };
  
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.slice(6);
      const decodedCredentials = atob(base64Credentials);
      const colonIndex = decodedCredentials.indexOf(':');
      
      debugDetails.decoded = {
        length: decodedCredentials.length,
        hasColon: colonIndex !== -1,
        colonIndex
      };
      
      if (colonIndex !== -1) {
        const username = decodedCredentials.substring(0, colonIndex);
        const token = decodedCredentials.substring(colonIndex + 1);
        
        // Compute hash like the validation function does
        try {
          const encoder = new TextEncoder();
          const tokenBytes = encoder.encode(token);
          const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
          const hashArray = new Uint8Array(hashBuffer);
          const computedHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
          
          debugDetails.hashComputed = computedHash.substring(0, 16) + '...';
          
          tokenInfo = {
            username,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 8) + '...' + token.substring(token.length - 8),
            computedHashPreview: computedHash.substring(0, 16) + '...',
            fullComputedHash: computedHash
          };
        } catch (hashError) {
          debugDetails.error = `Hash computation failed: ${hashError.message}`;
        }
      }
    } catch (error) {
      console.error(`[${requestId}] Error parsing auth header:`, error);
      debugDetails.error = `Auth parsing failed: ${error.message}`;
    }
  }
  
  const userAgent = req.headers.get('User-Agent');
  console.log(`[${requestId}] Debug - User agent: ${userAgent}`);
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    url: req.url,
    hasAuth: !!authHeader,
    tokenInfo,
    debugDetails,
    userAgent,
    isMacFinder: userAgent?.includes('WebDAVFS') || userAgent?.includes('Darwin'),
    headers: Object.fromEntries(req.headers.entries()),
    instructions: {
      connection: 'Use URL: https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/',
      username: 'webdav',
      password: 'Your 64-character WebDAV token',
      note: 'Check the logs above for token validation details'
    }
  };
  
  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/json'
    })
  });
}
