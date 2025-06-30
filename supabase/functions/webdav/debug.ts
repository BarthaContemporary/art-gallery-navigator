
import { getWebDAVResponseHeaders } from "./headers.ts";

export async function handleDebugToken(req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] Debug token endpoint called`);
  
  const authHeader = req.headers.get('Authorization');
  console.log(`[${requestId}] Debug - Auth header present: ${!!authHeader}`);
  
  if (authHeader) {
    console.log(`[${requestId}] Debug - Auth header: ${authHeader.substring(0, 20)}...`);
  }
  
  const userAgent = req.headers.get('User-Agent');
  console.log(`[${requestId}] Debug - User agent: ${userAgent}`);
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    url: req.url,
    hasAuth: !!authHeader,
    userAgent,
    headers: Object.fromEntries(req.headers.entries())
  };
  
  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/json'
    })
  });
}
