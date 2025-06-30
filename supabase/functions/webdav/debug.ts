
import { getWebDAVResponseHeaders } from "./headers.ts";

export async function handleDebugToken(req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] Debug token endpoint called`);
  
  const authHeader = req.headers.get('Authorization');
  console.log(`[${requestId}] Debug - Auth header present: ${!!authHeader}`);
  
  let tokenInfo = null;
  
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.slice(6);
      const decodedCredentials = atob(base64Credentials);
      const colonIndex = decodedCredentials.indexOf(':');
      
      if (colonIndex !== -1) {
        const username = decodedCredentials.substring(0, colonIndex);
        const token = decodedCredentials.substring(colonIndex + 1);
        
        // Compute hash like the validation function does
        const encoder = new TextEncoder();
        const tokenBytes = encoder.encode(token);
        const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
        const hashArray = new Uint8Array(hashBuffer);
        const computedHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');
        
        tokenInfo = {
          username,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 8) + '...' + token.substring(token.length - 8),
          computedHash: computedHash.substring(0, 16) + '...'
        };
      }
    } catch (error) {
      console.error(`[${requestId}] Error parsing auth header:`, error);
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
    userAgent,
    isMacFinder: userAgent?.includes('WebDAVFS') || userAgent?.includes('Darwin'),
    headers: Object.fromEntries(req.headers.entries()),
    instructions: {
      connection: 'Use URL: https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/webdav/',
      username: 'webdav',
      password: 'Your 64-character WebDAV token'
    }
  };
  
  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/json'
    })
  });
}
