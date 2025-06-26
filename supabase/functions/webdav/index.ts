
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, lock-token, timeout, translate, range',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH',
  'Access-Control-Expose-Headers': 'dav, ms-author-via, etag, last-modified, content-length, content-type, location',
  'Access-Control-Max-Age': '86400'
};

const webdavHeaders = {
  'DAV': '1, 2',
  'MS-Author-Via': 'DAV',
  'Server': 'Supabase-WebDAV/1.0',
  'Allow': 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH'
};

const getWebDAVResponseHeaders = (additionalHeaders = {}) => ({
  ...corsHeaders,
  ...webdavHeaders,
  ...additionalHeaders
});

interface UserInfo {
  user_id: string;
  token_id: string;
  is_admin: boolean;
}

interface AccessibleFolder {
  folder_id: string;
  folder_name: string;
  folder_path: string;
  artist_id: string | null;
  parent_folder_id: string | null;
  can_read: boolean;
  can_write: boolean;
}

interface AccessibleDocument {
  document_id: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  artist_id: string | null;
  can_read: boolean;
  can_write: boolean;
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[${requestId}] WebDAV ${req.method} ${req.url}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries([...req.headers.entries()].map(([k, v]) => 
    [k, k.toLowerCase() === 'authorization' ? 'Basic [REDACTED]' : v]
  )));

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling CORS preflight`);
    return new Response(null, { 
      status: 200,
      headers: getWebDAVResponseHeaders({
        'Content-Length': '0'
      })
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] Missing required environment variables`);
      return new Response('Server configuration error', { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization');
    
    // Check for authentication
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.log(`[${requestId}] No valid auth header, returning authentication challenge`);
      
      return new Response('Unauthorized - WebDAV authentication required', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server"',
          'Content-Type': 'text/plain'
        })
      });
    }

    // Decode Basic Auth credentials
    let username: string, token: string;
    try {
      const base64Credentials = authHeader.slice(6);
      const credentials = new TextDecoder().decode(
        Uint8Array.from(atob(base64Credentials), c => c.charCodeAt(0))
      );
      [username, token] = credentials.split(':', 2);
      
      if (!token || token.trim() === '') {
        throw new Error('Empty token');
      }
      
      console.log(`[${requestId}] Decoded credentials - username: ${username}, token: ${token.substring(0, 8)}...`);
    } catch (error) {
      console.error(`[${requestId}] Failed to decode credentials:`, error.message);
      return new Response('Invalid credentials format', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server"'
        })
      });
    }

    // Validate WebDAV token
    console.log(`[${requestId}] Validating token...`);
    const { data: tokenValidation, error: tokenError } = await supabase
      .rpc('validate_webdav_token', { token_text: token });

    if (tokenError) {
      console.error(`[${requestId}] Token validation error:`, tokenError);
      return new Response('Token validation failed', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server"'
        })
      });
    }

    if (!tokenValidation || tokenValidation.length === 0 || !tokenValidation[0].is_valid) {
      console.log(`[${requestId}] Invalid or expired token`);
      return new Response('Invalid or expired token', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server"'
        })
      });
    }

    const userInfo: UserInfo = {
      user_id: tokenValidation[0].user_id,
      token_id: tokenValidation[0].token_id,
      is_admin: false
    };

    console.log(`[${requestId}] User authenticated: ${userInfo.user_id}`);

    // Log access attempt
    await supabase.from('webdav_access_logs').insert({
      user_id: userInfo.user_id,
      token_id: userInfo.token_id,
      method: req.method,
      path: new URL(req.url).pathname,
      ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown',
      user_agent: req.headers.get('User-Agent') || 'unknown',
      status_code: 200
    });

    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname.replace('/functions/v1/webdav', '') || '/');
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    console.log(`[${requestId}] Processing ${req.method} for path: ${path}`);

    let response: Response;
    
    switch (req.method) {
      case 'PROPFIND':
        response = await handlePropfind(supabase, userInfo, path, req, requestId);
        break;
      case 'GET':
        response = await handleGet(supabase, userInfo, path, requestId);
        break;
      case 'PUT':
        response = await handlePut(supabase, userInfo, path, req, requestId);
        break;
      case 'DELETE':
        response = await handleDelete(supabase, userInfo, path, requestId);
        break;
      case 'MKCOL':
        response = await handleMkcol(supabase, userInfo, path, requestId);
        break;
      case 'MOVE':
        response = await handleMove(supabase, userInfo, path, req, requestId);
        break;
      case 'COPY':
        response = await handleCopy(supabase, userInfo, path, req, requestId);
        break;
      case 'LOCK':
        response = await handleLock(supabase, userInfo, path, req, requestId);
        break;
      case 'UNLOCK':
        response = await handleUnlock(supabase, userInfo, path, req, requestId);
        break;
      case 'PROPPATCH':
        response = await handleProppatch(supabase, userInfo, path, req, requestId);
        break;
      default:
        console.log(`[${requestId}] Method not allowed: ${req.method}`);
        response = new Response('Method not allowed', {
          status: 405,
          headers: getWebDAVResponseHeaders()
        });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${duration}ms with status ${response.status}`);
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] WebDAV error after ${duration}ms:`, error);
    return new Response('Internal server error: ' + error.message, {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});

async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPFIND for path: ${path}`);

  const depth = req.headers.get('Depth') || '1';
  
  try {
    if (path === '/' || path === '') {
      console.log(`[${requestId}] PROPFIND: Fetching accessible folders for user`);
      const { data: folders, error } = await supabase
        .rpc('get_user_accessible_folders');

      if (error) {
        console.error(`[${requestId}] Error fetching folders:`, error);
        return new Response('Internal server error: ' + error.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] PROPFIND: Found ${folders?.length || 0} accessible folders`);

      const folderItems = (folders || []).map((folder: AccessibleFolder) => `
        <D:response>
          <D:href>/functions/v1/webdav/${encodeURIComponent(folder.folder_name)}/</D:href>
          <D:propstat>
            <D:prop>
              <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
              <D:resourcetype><D:collection/></D:resourcetype>
              <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
              <D:creationdate>${new Date().toISOString()}</D:creationdate>
              <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
              <D:getcontentlength>0</D:getcontentlength>
              <D:supportedlock>
                <D:lockentry>
                  <D:lockscope><D:exclusive/></D:lockscope>
                  <D:locktype><D:write/></D:locktype>
                </D:lockentry>
              </D:supportedlock>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
          </D:propstat>
        </D:response>`).join('');

      const response = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>/functions/v1/webdav/</D:href>
            <D:propstat>
              <D:prop>
                <D:displayname>WebDAV Root</D:displayname>
                <D:resourcetype><D:collection/></D:resourcetype>
                <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
                <D:creationdate>${new Date().toISOString()}</D:creationdate>
                <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
                <D:getcontentlength>0</D:getcontentlength>
                <D:supportedlock>
                  <D:lockentry>
                    <D:lockscope><D:exclusive/></D:lockscope>
                    <D:locktype><D:write/></D:locktype>
                  </D:lockentry>
                </D:supportedlock>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          ${folderItems}
        </D:multistatus>`;

      console.log(`[${requestId}] PROPFIND: Returning root directory with ${(folders || []).length} folders`);
      return new Response(response, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset="utf-8"'
        })
      });
    } else {
      // Handle folder contents
      const folderName = path.split('/').filter(p => p)[0];
      console.log(`[${requestId}] PROPFIND: Fetching folder contents for: ${folderName}`);
      
      const { data: folders, error: foldersError } = await supabase
        .rpc('get_user_accessible_folders');

      if (foldersError) {
        console.error(`[${requestId}] Error fetching folders:`, foldersError);
        return new Response('Internal server error: ' + foldersError.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      const folder = folders?.find((f: AccessibleFolder) => f.folder_name === folderName);
      if (!folder) {
        console.log(`[${requestId}] PROPFIND: Folder not found: ${folderName}`);
        return new Response('Folder not found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }

      const { data: documents, error: docsError } = await supabase
        .rpc('get_user_accessible_documents', { folder_id_param: folder.folder_id });

      if (docsError) {
        console.error(`[${requestId}] Error fetching documents:`, docsError);
        return new Response('Internal server error: ' + docsError.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] PROPFIND: Found ${documents?.length || 0} documents in folder`);

      const documentItems = (documents || []).map((doc: AccessibleDocument) => `
        <D:response>
          <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(doc.document_name)}</D:href>
          <D:propstat>
            <D:prop>
              <D:displayname>${escapeXml(doc.document_name)}</D:displayname>
              <D:getcontentlength>${doc.file_size || 0}</D:getcontentlength>
              <D:getcontenttype>${doc.mime_type || 'application/octet-stream'}</D:getcontenttype>
              <D:creationdate>${new Date().toISOString()}</D:creationdate>
              <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
              <D:resourcetype/>
              <D:getetag>"${crypto.randomUUID()}"</D:getetag>
              <D:supportedlock>
                <D:lockentry>
                  <D:lockscope><D:exclusive/></D:lockscope>
                  <D:locktype><D:write/></D:locktype>
                </D:lockentry>
              </D:supportedlock>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
          </D:propstat>
        </D:response>`).join('');

      const response = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/</D:href>
            <D:propstat>
              <D:prop>
                <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
                <D:resourcetype><D:collection/></D:resourcetype>
                <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
                <D:creationdate>${new Date().toISOString()}</D:creationdate>
                <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
                <D:getcontentlength>0</D:getcontentlength>
                <D:supportedlock>
                  <D:lockentry>
                    <D:lockscope><D:exclusive/></D:lockscope>
                    <D:locktype><D:write/></D:locktype>
                  </D:lockentry>
                </D:supportedlock>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          ${documentItems}
        </D:multistatus>`;

      return new Response(response, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset="utf-8"'
        })
      });
    }
  } catch (error) {
    console.error(`[${requestId}] PROPFIND error:`, error);
    return new Response('Internal server error: ' + error.message, { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string) {
  console.log(`[${requestId}] GET for path: ${path}`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    console.log(`[${requestId}] GET: Invalid path structure: ${path}`);
    return new Response('Invalid path', { 
      status: 404, 
      headers: getWebDAVResponseHeaders()
    });
  }

  const [folderName, fileName] = pathParts;

  try {
    const { data: documents, error } = await supabase
      .rpc('get_user_accessible_documents');

    if (error) {
      console.error(`[${requestId}] Error fetching documents:`, error);
      return new Response('Internal server error: ' + error.message, { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const document = documents?.find((doc: AccessibleDocument) => 
      doc.document_name === fileName && doc.can_read
    );

    if (!document) {
      console.log(`[${requestId}] GET: File not found or not accessible: ${fileName}`);
      return new Response('File not found', { 
        status: 404, 
        headers: getWebDAVResponseHeaders()
      });
    }

    console.log(`[${requestId}] GET: Redirecting to file URL: ${document.file_url}`);
    return new Response(null, {
      status: 302,
      headers: getWebDAVResponseHeaders({
        'Location': document.file_url
      })
    });
  } catch (error) {
    console.error(`[${requestId}] GET error:`, error);
    return new Response('Internal server error: ' + error.message, { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handlePut(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PUT for path: ${path}`);
  
  return new Response('File uploads not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleDelete(supabase: any, userInfo: UserInfo, path: string, requestId: string) {
  console.log(`[${requestId}] DELETE for path: ${path}`);
  
  return new Response('File deletions not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleMkcol(supabase: any, userInfo: UserInfo, path: string, requestId: string) {
  console.log(`[${requestId}] MKCOL for path: ${path}`);
  
  return new Response('Folder creation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleMove(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] MOVE for path: ${path}`);
  
  return new Response('Move operation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleCopy(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] COPY for path: ${path}`);
  
  return new Response('Copy operation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleLock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] LOCK for path: ${path}`);
  
  const lockResponse = `<?xml version="1.0" encoding="utf-8"?>
    <D:prop xmlns:D="DAV:">
      <D:lockdiscovery>
        <D:activelock>
          <D:locktype><D:write/></D:locktype>
          <D:lockscope><D:exclusive/></D:lockscope>
          <D:depth>0</D:depth>
          <D:timeout>Second-3600</D:timeout>
          <D:locktoken>
            <D:href>urn:uuid:${crypto.randomUUID()}</D:href>
          </D:locktoken>
        </D:activelock>
      </D:lockdiscovery>
    </D:prop>`;
  
  return new Response(lockResponse, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset="utf-8"',
      'Lock-Token': `<urn:uuid:${crypto.randomUUID()}>`
    })
  });
}

async function handleUnlock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] UNLOCK for path: ${path}`);
  
  return new Response('', {
    status: 204,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleProppatch(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPPATCH for path: ${path}`);
  
  const response = `<?xml version="1.0" encoding="utf-8"?>
    <D:multistatus xmlns:D="DAV:">
      <D:response>
        <D:href>${path}</D:href>
        <D:propstat>
          <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
      </D:response>
    </D:multistatus>`;
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset="utf-8"'
    })
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
