
import { getWebDAVResponseHeaders } from "./headers.ts";

export async function handleDebugToken(req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] Debug token endpoint called`);
  
  const authHeader = req.headers.get('Authorization');
  const userAgent = req.headers.get('User-Agent') || 'unknown';
  
  console.log(`[${requestId}] Debug - Auth header present: ${!!authHeader}`);
  console.log(`[${requestId}] Debug - User agent: ${userAgent}`);
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId,
    userAgent,
    authHeaderPresent: !!authHeader,
    authHeaderSample: authHeader ? authHeader.substring(0, 20) + '...' : null,
    headers: Object.fromEntries(req.headers.entries()),
    url: req.url,
    method: req.method
  };
  
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.slice(6);
      const decodedCredentials = atob(base64Credentials);
      const colonIndex = decodedCredentials.indexOf(':');
      
      if (colonIndex !== -1) {
        const username = decodedCredentials.substring(0, colonIndex);
        const token = decodedCredentials.substring(colonIndex + 1);
        
        debugInfo.parsedCredentials = {
          username,
          tokenLength: token.length,
          tokenSample: token.substring(0, 8) + '...'
        };
      }
    } catch (error) {
      debugInfo.credentialParsingError = error.message;
    }
  }
  
  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/json'
    })
  });
}
