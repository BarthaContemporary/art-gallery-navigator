
import { getWebDAVResponseHeaders } from "../headers.ts";
import { UserInfo } from "../auth.ts";

export async function handleMkcol(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] MKCOL (create collection/folder) for path: "${path}"`);
  
  // For now, return method not allowed as we don't support folder creation via WebDAV
  // This prevents Mac Finder from trying to create folders that won't be persistent
  return new Response('Folder creation not supported via WebDAV', {
    status: 405,
    headers: getWebDAVResponseHeaders({
      'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE'
    })
  });
}

export async function handleDelete(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] DELETE for path: "${path}"`);
  
  // For now, return method not allowed to prevent accidental deletions
  // Can be implemented later with proper safety checks
  return new Response('Delete not yet implemented', {
    status: 405,
    headers: getWebDAVResponseHeaders({
      'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT'
    })
  });
}

export async function handleLock(path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] LOCK request for path: "${path}"`);
  
  // Return a fake lock token to satisfy Mac Finder
  const lockToken = `opaquelocktoken:${crypto.randomUUID()}`;
  
  const lockResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner>webdav</D:owner>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;

  return new Response(lockResponse, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8',
      'Lock-Token': `<${lockToken}>`,
      'Timeout': 'Second-3600'
    })
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
      'Content-Type': 'application/xml; charset=utf-8'
    })
  });
}
