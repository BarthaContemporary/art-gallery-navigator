
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, lock-token, timeout, translate, range, content-length, user-agent, accept, accept-encoding, accept-language, cache-control, connection, host, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD',
  'Access-Control-Expose-Headers': 'dav, ms-author-via, etag, last-modified, content-length, content-type, location, lock-token, timeout',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

const webdavHeaders = {
  'DAV': '1, 2, 3, extend, access-control',
  'MS-Author-Via': 'DAV',
  'Server': 'Supabase-WebDAV/1.0',
  'Allow': 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD'
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

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[${requestId}] ${req.method} ${new URL(req.url).pathname}`);
  console.log(`[${requestId}] User-Agent: ${req.headers.get('User-Agent') || 'unknown'}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight with enhanced logging
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight - responding with enhanced headers`);
    return new Response('', { 
      status: 200,
      headers: getWebDAVResponseHeaders()
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] Missing environment variables`);
      return new Response('Server configuration error', { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    
    // Enhanced WebDAV authentication flow
    if (!authHeader) {
      console.log(`[${requestId}] No auth header - sending WWW-Authenticate challenge`);
      return new Response('WebDAV authentication required', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    if (!authHeader.startsWith('Basic ')) {
      console.log(`[${requestId}] Invalid auth type: ${authHeader.substring(0, 20)}...`);
      return new Response('Basic authentication required', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    // Enhanced Basic Auth parsing with detailed logging
    let username: string, token: string;
    try {
      const base64Credentials = authHeader.slice(6);
      console.log(`[${requestId}] Base64 credentials length: ${base64Credentials.length}`);
      
      const credentials = atob(base64Credentials);
      console.log(`[${requestId}] Decoded credentials length: ${credentials.length}`);
      
      const colonIndex = credentials.indexOf(':');
      
      if (colonIndex === -1) {
        console.log(`[${requestId}] No colon found in credentials`);
        throw new Error('Invalid credentials format - no colon separator');
      }
      
      username = credentials.substring(0, colonIndex);
      token = credentials.substring(colonIndex + 1);
      
      console.log(`[${requestId}] Parsed username: "${username}", token length: ${token.length}`);
      console.log(`[${requestId}] Token sample: ${token.substring(0, 8)}...`);
      
      // Validate token format
      if (token.length !== 64) {
        console.log(`[${requestId}] Invalid token length: expected 64, got ${token.length}`);
        throw new Error(`Invalid token length: expected 64 characters, got ${token.length}`);
      }
      
      // Check if token contains only valid hex characters
      if (!/^[a-f0-9]+$/i.test(token)) {
        console.log(`[${requestId}] Token contains invalid characters`);
        throw new Error('Token contains invalid characters - expected hex only');
      }
      
    } catch (error) {
      console.error(`[${requestId}] Failed to parse credentials:`, error.message);
      return new Response('Invalid credentials format', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    // Enhanced token validation with comprehensive logging
    console.log(`[${requestId}] Validating token with database function...`);
    
    const { data: tokenValidation, error: tokenError } = await supabase
      .rpc('validate_webdav_token', { token_text: token });

    console.log(`[${requestId}] Token validation response:`, { 
      tokenValidation, 
      tokenError,
      validationCount: tokenValidation?.length || 0
    });

    if (tokenError) {
      console.error(`[${requestId}] Token validation RPC error:`, tokenError);
      return new Response('Token validation failed', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    if (!tokenValidation || tokenValidation.length === 0) {
      console.log(`[${requestId}] No validation result returned from database`);
      return new Response('Invalid or expired token', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    const validationResult = tokenValidation[0];
    console.log(`[${requestId}] Validation result:`, validationResult);
    
    if (!validationResult.is_valid) {
      console.log(`[${requestId}] Token validation failed: token is not valid`);
      return new Response('Token is invalid or expired', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    if (!validationResult.user_id || !validationResult.token_id) {
      console.log(`[${requestId}] Invalid validation result: missing user_id or token_id`);
      return new Response('Authentication failed', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain'
        })
      });
    }

    const userInfo: UserInfo = {
      user_id: validationResult.user_id,
      token_id: validationResult.token_id,
      is_admin: false
    };

    console.log(`[${requestId}] User authenticated successfully: ${userInfo.user_id}`);

    // Log access attempt (non-blocking)
    supabase.from('webdav_access_logs').insert({
      user_id: userInfo.user_id,
      token_id: userInfo.token_id,
      method: req.method,
      path: new URL(req.url).pathname,
      ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown',
      user_agent: req.headers.get('User-Agent') || 'unknown',
      status_code: 200
    }).then(result => {
      if (result.error) {
        console.log(`[${requestId}] Failed to log access (non-critical):`, result.error);
      }
    });

    // Parse path with enhanced logging
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname.replace('/functions/v1/webdav', '') || '/');
    if (!path.startsWith('/')) path = '/' + path;
    
    console.log(`[${requestId}] Processing ${req.method} for path: "${path}"`);

    // Route to handlers with comprehensive error handling
    let response: Response;
    
    try {
      switch (req.method) {
        case 'PROPFIND':
          response = await handlePropfind(supabase, userInfo, path, req, requestId);
          break;
        case 'GET':
        case 'HEAD':
          response = await handleGet(supabase, userInfo, path, requestId, req.method === 'HEAD');
          break;
        case 'PUT':
        case 'DELETE':
        case 'MKCOL':
        case 'MOVE':
        case 'COPY':
          console.log(`[${requestId}] Method ${req.method} not yet implemented`);
          response = new Response('Method not implemented', {
            status: 501,
            headers: getWebDAVResponseHeaders()
          });
          break;
        case 'LOCK':
          response = await handleLock(path, requestId);
          break;
        case 'UNLOCK':
          response = new Response('', {
            status: 204,
            headers: getWebDAVResponseHeaders()
          });
          break;
        case 'PROPPATCH':
          response = await handleProppatch(path, requestId);
          break;
        default:
          console.log(`[${requestId}] Method not allowed: ${req.method}`);
          response = new Response('Method not allowed', {
            status: 405,
            headers: getWebDAVResponseHeaders({
              'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH'
            })
          });
      }
    } catch (handlerError) {
      console.error(`[${requestId}] Handler error for ${req.method}:`, handlerError);
      response = new Response('Internal server error in request handler', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }

    console.log(`[${requestId}] Completed in ${Date.now() - startTime}ms with status ${response.status}`);
    return response;

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});

async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);

  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth}`);
  
  try {
    if (path === '/' || path === '') {
      // Root directory - show accessible folders
      console.log(`[${requestId}] Fetching accessible folders for user`);
      const { data: folders, error } = await supabase.rpc('get_user_accessible_folders');

      if (error) {
        console.error(`[${requestId}] Error fetching folders:`, error);
        return new Response('Internal server error', { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Found ${folders?.length || 0} accessible folders`);

      const folderItems = (folders || []).map((folder: any) => `
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
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
          </D:propstat>
        </D:response>`).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
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
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  ${folderItems}
</D:multistatus>`;

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString()
        })
      });
    } else {
      // Folder contents
      const folderName = path.split('/').filter(p => p)[0];
      console.log(`[${requestId}] Fetching contents for folder: "${folderName}"`);
      
      const { data: folders } = await supabase.rpc('get_user_accessible_folders');
      const folder = folders?.find((f: any) => f.folder_name === folderName);
      
      if (!folder) {
        console.log(`[${requestId}] Folder not found or not accessible: "${folderName}"`);
        return new Response('Not Found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Fetching documents for folder ID: ${folder.folder_id}`);
      const { data: documents } = await supabase.rpc('get_user_accessible_documents', { 
        folder_id_param: folder.folder_id 
      });

      console.log(`[${requestId}] Found ${documents?.length || 0} documents in folder`);

      const documentItems = (documents || []).map((doc: any) => `
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
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
          </D:propstat>
        </D:response>`).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
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
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  ${documentItems}
</D:multistatus>`;

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString()
        })
      });
    }
  } catch (error) {
    console.error(`[${requestId}] PROPFIND error:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string, isHead = false) {
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    console.log(`[${requestId}] Invalid path structure: expected 2 parts, got ${pathParts.length}`);
    return new Response('Not Found', { 
      status: 404, 
      headers: getWebDAVResponseHeaders()
    });
  }

  const [folderName, fileName] = pathParts;
  console.log(`[${requestId}] Looking for file "${fileName}" in folder "${folderName}"`);

  try {
    const { data: documents } = await supabase.rpc('get_user_accessible_documents');
    const document = documents?.find((doc: any) => 
      doc.document_name === fileName && doc.can_read
    );

    if (!document) {
      console.log(`[${requestId}] Document not found or not accessible: "${fileName}"`);
      return new Response('Not Found', { 
        status: 404, 
        headers: getWebDAVResponseHeaders()
      });
    }

    console.log(`[${requestId}] Found document, redirecting to: ${document.file_url}`);

    if (isHead) {
      return new Response(null, {
        status: 200,
        headers: getWebDAVResponseHeaders({
          'Content-Length': document.file_size?.toString() || '0',
          'Content-Type': document.mime_type || 'application/octet-stream',
          'Last-Modified': new Date().toUTCString(),
          'ETag': `"${crypto.randomUUID()}"`
        })
      });
    }

    return new Response(null, {
      status: 302,
      headers: getWebDAVResponseHeaders({
        'Location': document.file_url
      })
    });
  } catch (error) {
    console.error(`[${requestId}] GET error:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handleLock(path: string, requestId: string) {
  console.log(`[${requestId}] LOCK for path: "${path}"`);
  
  const lockToken = crypto.randomUUID();
  const lockResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken>
        <D:href>urn:uuid:${lockToken}</D:href>
      </D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
  
  return new Response(lockResponse, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8',
      'Lock-Token': `<urn:uuid:${lockToken}>`,
      'Content-Length': new TextEncoder().encode(lockResponse).length.toString()
    })
  });
}

async function handleProppatch(path: string, requestId: string) {
  console.log(`[${requestId}] PROPPATCH for path: "${path}"`);
  
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
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': new TextEncoder().encode(response).length.toString()
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
