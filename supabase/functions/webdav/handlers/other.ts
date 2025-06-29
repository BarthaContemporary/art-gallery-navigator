
import { getWebDAVResponseHeaders } from "../headers.ts";
import { UserInfo } from "../auth.ts";

// In-memory lock storage for demo purposes (use database in production)
const activeLocks = new Map<string, {
  token: string;
  owner: string;
  timeout: number;
  created: number;
  path: string;
}>();

export async function handleMkcol(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] MKCOL (create collection/folder) for path: "${path}"`);
  
  // For now, return method not allowed as we don't support folder creation via WebDAV
  // This prevents Mac Finder from trying to create folders that won't be persistent
  return new Response('', {
    status: 405,
    headers: getWebDAVResponseHeaders({
      'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MOVE, COPY, LOCK, UNLOCK'
    })
  });
}

export async function handleDelete(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] DELETE for path: "${path}"`);
  
  // For now, return method not allowed to prevent accidental deletions
  // Can be implemented later with proper safety checks
  return new Response('', {
    status: 405,
    headers: getWebDAVResponseHeaders({
      'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, MOVE, COPY, LOCK, UNLOCK'
    })
  });
}

export async function handleLock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] LOCK request for path: "${path}"`);
  
  const lockToken = `opaquelocktoken:${crypto.randomUUID()}`;
  const timeout = 3600; // 1 hour
  const owner = userInfo.user_id;
  
  // Store the lock
  activeLocks.set(path, {
    token: lockToken,
    owner,
    timeout,
    created: Date.now(),
    path
  });
  
  const lockResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner>${owner}</D:owner>
      <D:timeout>Second-${timeout}</D:timeout>
      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
      <D:lockroot><D:href>${path}</D:href></D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;

  return new Response(lockResponse, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Lock-Token': `<${lockToken}>`,
      'Timeout': `Second-${timeout}`,
      'Content-Length': lockResponse.length.toString()
    })
  });
}

export async function handleUnlock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] UNLOCK request for path: "${path}"`);
  
  const lockTokenHeader = req.headers.get('Lock-Token');
  if (lockTokenHeader) {
    const token = lockTokenHeader.replace(/[<>]/g, '');
    const lock = activeLocks.get(path);
    
    if (lock && lock.token === token) {
      activeLocks.delete(path);
      console.log(`[${requestId}] Lock removed for path: "${path}"`);
    }
  }
  
  return new Response('', {
    status: 204,
    headers: getWebDAVResponseHeaders({
      'Content-Length': '0'
    })
  });
}

export async function handleMove(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] MOVE request from path: "${path}"`);
  
  const destination = req.headers.get('Destination');
  if (!destination) {
    return new Response('Bad Request: Missing Destination header', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] MOVE destination: "${destination}"`);
  
  // For now, return not implemented
  return new Response('Move operation not yet implemented', {
    status: 501,
    headers: getWebDAVResponseHeaders()
  });
}

export async function handleCopy(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] COPY request from path: "${path}"`);
  
  const destination = req.headers.get('Destination');
  if (!destination) {
    return new Response('Bad Request: Missing Destination header', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] COPY destination: "${destination}"`);
  
  // For now, return not implemented
  return new Response('Copy operation not yet implemented', {
    status: 501,
    headers: getWebDAVResponseHeaders()
  });
}

export async function handleProppatch(path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] PROPPATCH request for path: "${path}"`);
  
  // Return success for property updates (Mac Finder compatibility)
  const proppatchResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${path}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

  return new Response(proppatchResponse, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': proppatchResponse.length.toString()
    })
  });
}
