import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Apple/Mac-optimized CORS headers for WebDAV
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, range, if-match, if-none-match, user-agent',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK',
  'Access-Control-Expose-Headers': 'DAV, MS-Author-Via, Accept-Ranges, Content-Range, ETag, Last-Modified',
  'DAV': '1, 2, 3',
  'MS-Author-Via': 'DAV',
  'Allow': 'OPTIONS, PROPFIND, PROPPATCH, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, LOCK, UNLOCK',
  'Accept-Ranges': 'bytes',
  'Server': 'WebDAV/1.0',
};

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling OPTIONS (CORS preflight)`);
    return new Response('', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] Missing environment variables`);
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    let path = url.pathname;
    console.log(`[${requestId}] Original pathname: "${path}"`);
    
    // Remove the webdav function path prefix
    if (path.includes('/functions/v1/webdav')) {
      path = path.substring(path.indexOf('/functions/v1/webdav') + '/functions/v1/webdav'.length);
    }
    
    // Normalize path - ensure it starts with / and handle empty paths
    if (!path || path === '') {
      path = '/';
    } else if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    console.log(`[${requestId}] Processing path: "${path}"`);

    // Handle debug endpoint for testing
    if (path === '/debug-token' && req.method === 'GET') {
      console.log(`[${requestId}] Debug endpoint accessed`);
      return new Response(JSON.stringify({
        status: 'success',
        message: 'WebDAV function is running',
        timestamp: new Date().toISOString(),
        requestId,
        path,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries())
      }, null, 2), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      });
    }

    // Authenticate user and get permissions
    const authResult = await authenticateUser(req, supabase, requestId);
    if (!authResult.success) {
      console.log(`[${requestId}] Authentication failed:`, authResult.error);
      
      return new Response(JSON.stringify({
        error: 'Authentication failed',
        details: authResult.error || 'Invalid credentials',
        timestamp: new Date().toISOString(),
        requestId
      }, null, 2), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Basic realm="WebDAV Server"',
        }
      });
    }

    const { userId, isAdmin } = authResult;
    console.log(`[${requestId}] Auth successful for user: ${userId}, admin: ${isAdmin}`);

    // Route to handlers with user context
    const userContext = { userId, isAdmin, supabase, requestId };
    
    if (req.method === 'PROPFIND') {
      return await handlePropfind(path, req, userContext);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      return await handleGet(path, req.method === 'HEAD', userContext);
    } else if (req.method === 'PUT') {
      return await handlePut(path, req, userContext);
    } else if (req.method === 'DELETE') {
      return await handleDelete(path, userContext);
    } else if (req.method === 'MKCOL') {
      return await handleMkcol(path, userContext);
    } else if (req.method === 'PROPPATCH') {
      return await handleProppatch(path, req, userContext);
    } else if (req.method === 'COPY' || req.method === 'MOVE') {
      return await handleCopyMove(path, req, userContext);
    }

    console.log(`[${requestId}] Unhandled method: ${req.method} for path: ${path}`);
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain',
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Server error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    });
  }
});

// Authentication function using WebDAV tokens
async function authenticateUser(req: Request, supabase: any, requestId: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log(`[${requestId}] Missing or invalid auth header`);
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  try {
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(':');
    
    console.log(`[${requestId}] Authenticating user: ${username}, token length: ${password?.length || 0}`);

    if (!password || password.length === 0) {
      console.log(`[${requestId}] Empty password/token`);
      return { success: false, error: 'Empty or missing token' };
    }

    console.log(`[${requestId}] Calling validate_webdav_token with token...`);

    // Validate WebDAV token with better error handling
    const { data: tokenData, error: tokenError } = await supabase.rpc('validate_webdav_token', { 
      token_text: password 
    });

    console.log(`[${requestId}] RPC response - data:`, tokenData, 'error:', tokenError);

    if (tokenError) {
      console.error(`[${requestId}] Token validation RPC error:`, tokenError);
      return { 
        success: false, 
        error: 'Database error during token validation', 
        details: tokenError.message || 'Unknown database error'
      };
    }

    if (!tokenData || tokenData.length === 0) {
      console.log(`[${requestId}] No token data returned from RPC`);
      return { success: false, error: 'Token validation returned no data' };
    }

    // Get first result from array
    const validation = tokenData[0];
    if (!validation.is_valid) {
      console.log(`[${requestId}] Token marked as invalid. User: ${username}, token data:`, validation);
      return { 
        success: false, 
        error: 'Invalid or expired token',
        details: `Token validation failed for user: ${username}`
      };
    }

    console.log(`[${requestId}] Token validation successful for user ID: ${validation.user_id}`);

    // Check if user is admin
    const { data: adminCheck, error: adminError } = await supabase.rpc('has_role', {
      _user_id: validation.user_id,
      _role: 'gallery_admin'
    });

    if (adminError) {
      console.error(`[${requestId}] Admin check error:`, adminError);
      return { 
        success: false, 
        error: 'Failed to check user permissions', 
        details: adminError.message || 'Unknown admin check error'
      };
    }

    return {
      success: true,
      userId: validation.user_id,
      isAdmin: !!adminCheck,
      tokenId: validation.token_id
    };
  } catch (error) {
    console.error(`[${requestId}] Auth exception:`, error);
    return { 
      success: false, 
      error: 'Authentication system error', 
      details: error.message || 'Unknown authentication error'
    };
  }
}

// Apple-optimized PROPFIND handler
async function handlePropfind(path: string, req: Request, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);
  
  const depth = req.headers.get('Depth') || '1';
  
  if (path === '/' || path === '') {
    // Root directory - list accessible folders
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userId
    });

    const xmlResponse = createPropfindResponse('/', folders || [], [], depth);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      }
    });
  } else {
    // Folder contents - list accessible documents
    const folderName = path.replace(/^\/+|\/+$/g, '');
    
    // Find folder and check access
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userId
    });
    
    const folder = folders?.find((f: any) => f.folder_name === folderName);
    if (!folder || !folder.can_read) {
      console.log(`[${requestId}] Folder "${folderName}" not found or no access`);
      // Return proper WebDAV 404 response
      const notFoundXml = `<?xml version="1.0" encoding="utf-8"?>
<D:error xmlns:D="DAV:">
  <D:status>HTTP/1.1 404 Not Found</D:status>
</D:error>`;
      return new Response(notFoundXml, {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset=utf-8',
        }
      });
    }

    const { data: documents } = await supabase.rpc('get_user_accessible_documents', {
      folder_id_param: folder.folder_id
    });

    const xmlResponse = createPropfindResponse(path, [], documents || [], depth);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      }
    });
  }
}

// Apple-optimized GET/HEAD handler with range support
async function handleGet(path: string, isHead: boolean, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  if (path === '/' || path === '') {
    // Root directory HTML
    const html = `<!DOCTYPE html>
<html><head><title>WebDAV Server</title></head>
<body><h1>WebDAV Server</h1><p>Connected successfully!</p></body></html>`;
    
    return new Response(isHead ? null : html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Length': html.length.toString(),
        'Last-Modified': new Date().toUTCString(),
        'ETag': '"' + btoa(html).substring(0, 8) + '"',
      }
    });
  }

  // File download - parse folder/filename and check access
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  // Check folder access
  const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userId
  });
  
  const folder = folders?.find((f: any) => f.folder_name === folderName);
  if (!folder || !folder.can_read) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  // Get document with access check
  const { data: documents } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: folder.folder_id
  });

  const document = documents?.find((d: any) => d.document_name === fileName);
  if (!document) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const lastModified = new Date(document.created_at || Date.now()).toUTCString();
  const etag = '"' + btoa(document.document_id).substring(0, 12) + '"';

  if (isHead) {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': (document.file_size || 0).toString(),
        'Last-Modified': lastModified,
        'ETag': etag,
      }
    });
  }

  try {
    if (document.file_url.startsWith('placeholder://')) {
      return new Response('File not yet uploaded to storage', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      return new Response('File not accessible', { status: 404, headers: corsHeaders });
    }

    const fileContent = await fileResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    return new Response(fileContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Last-Modified': lastModified,
        'ETag': etag,
      }
    });
  } catch (error) {
    console.error(`[${requestId}] File download error:`, error);
    return new Response('File error', { status: 500, headers: corsHeaders });
  }
}

// Basic PUT handler placeholder
async function handlePut(path: string, req: Request, userContext: any) {
  const { requestId } = userContext;
  console.log(`[${requestId}] PUT not implemented yet for path: "${path}"`);
  return new Response('Not Implemented', { status: 501, headers: corsHeaders });
}

// Basic DELETE handler placeholder
async function handleDelete(path: string, userContext: any) {
  const { requestId } = userContext;
  console.log(`[${requestId}] DELETE not implemented yet for path: "${path}"`);
  return new Response('Not Implemented', { status: 501, headers: corsHeaders });
}

// Basic MKCOL handler placeholder
async function handleMkcol(path: string, userContext: any) {
  const { requestId } = userContext;
  console.log(`[${requestId}] MKCOL not implemented yet for path: "${path}"`);
  return new Response('Not Implemented', { status: 501, headers: corsHeaders });
}

// PROPPATCH handler for property updates
async function handleProppatch(path: string, req: Request, userContext: any) {
  const { requestId } = userContext;
  console.log(`[${requestId}] PROPPATCH for path: "${path}" - properties not modifiable`);
  
  return new Response('', {
    status: 207,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
    }
  });
}

// COPY/MOVE handler for file operations
async function handleCopyMove(path: string, req: Request, userContext: any) {
  const { requestId } = userContext;
  const method = req.method;
  console.log(`[${requestId}] ${method} for path: "${path}" - not implemented yet`);
  
  return new Response('Not Implemented', {
    status: 501,
    headers: corsHeaders
  });
}

// Apple-optimized XML response creator with full WebDAV properties
function createPropfindResponse(path: string, folders: any[], documents: any[], depth: string = '1'): string {
  const escapeXml = (str: string) => str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:A="http://www.apple.com/webdav_fs/">`;

  // Add current directory with Apple-specific properties
  const currentName = path === '/' ? 'WebDAV Root' : path.split('/').pop() || '';
  xml += `
  <D:response>
    <D:href>/functions/v1/webdav${path}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(currentName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:getetag>"${btoa(path).substring(0, 8)}"</D:getetag>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

  // Add folders with Apple-specific properties
  for (const folder of folders) {
    const folderName = folder.folder_name || folder.name;
    const created = new Date(folder.created_at || Date.now()).toISOString();
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folderName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date(folder.created_at || Date.now()).toUTCString()}</D:getlastmodified>
        <D:creationdate>${created}</D:creationdate>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:getetag>"${btoa(folderName).substring(0, 8)}"</D:getetag>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  // Add documents with full WebDAV properties
  for (const doc of documents) {
    const fileName = doc.document_name || doc.file_name;
    const folderName = path.replace(/^\/+|\/+$/g, '');
    const created = new Date(doc.created_at || Date.now()).toISOString();
    const fileSize = doc.file_size || 0;
    const mimeType = doc.mime_type || 'application/octet-stream';
    
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(fileName)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${escapeXml(mimeType)}</D:getcontenttype>
        <D:getlastmodified>${new Date(doc.created_at || Date.now()).toUTCString()}</D:getlastmodified>
        <D:creationdate>${created}</D:creationdate>
        <D:getetag>"${btoa(doc.document_id || fileName).substring(0, 12)}"</D:getetag>
        <D:resourcetype/>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  xml += '\n</D:multistatus>';
  return xml;
}