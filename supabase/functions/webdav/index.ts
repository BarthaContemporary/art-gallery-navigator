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
  'DAV': '1, 2, 3',
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
  console.log(`WebDAV ${req.method} ${req.url} - Headers:`, Object.fromEntries(req.headers.entries()));

  if (req.method === 'OPTIONS') {
    console.log('WebDAV: Handling CORS preflight');
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
      console.error('WebDAV: Missing required environment variables');
      return new Response('Server configuration error', { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    console.log('WebDAV: Creating Supabase client');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.log('WebDAV: No valid auth header, returning info page');
      
      const infoPage = `<!DOCTYPE html>
<html>
<head>
    <title>WebDAV Server</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .info { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .warning { background: #fefce8; border: 1px solid #eab308; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .capabilities { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        ol { line-height: 1.6; }
    </style>
</head>
<body>
    <h1>WebDAV Server</h1>
    <p>This is a WebDAV server endpoint that should be accessed using a WebDAV client, not a web browser.</p>
    
    <div class="capabilities">
        <h3>📋 WebDAV Capabilities:</h3>
        <ul>
            <li><strong>DAV Compliance:</strong> ${webdavHeaders.DAV}</li>
            <li><strong>Supported Methods:</strong> ${webdavHeaders.Allow}</li>
            <li><strong>Server:</strong> ${webdavHeaders.Server}</li>
        </ul>
    </div>
    
    <div class="info">
        <h3>📁 WebDAV Connection Instructions:</h3>
        <ol>
            <li>Create a WebDAV token in your account (File Management → WebDAV Access)</li>
            <li>Open your file manager (Finder, Windows Explorer, etc.)</li>
            <li>Connect to: <code>${req.url}</code></li>
            <li>Username: <code>webdav</code> (or any value)</li>
            <li>Password: Your WebDAV token</li>
        </ol>
    </div>
    
    <div class="warning">
        <h3>⚠️ For macOS Finder:</h3>
        <p>Press <strong>Cmd+K</strong> and enter the URL above, then use your WebDAV token as the password.</p>
    </div>
    
    <p>If you're seeing this page, the WebDAV server is running correctly!</p>
</body>
</html>`;

      return new Response(infoPage, {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'text/html; charset=utf-8',
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        })
      });
    }

    console.log('WebDAV: Decoding Basic Auth credentials');
    const base64Credentials = authHeader.slice(6);
    const credentials = new TextDecoder().decode(
      Uint8Array.from(atob(base64Credentials), c => c.charCodeAt(0))
    );
    const [username, token] = credentials.split(':');

    if (!token) {
      console.error('WebDAV: No token provided in credentials');
      return new Response('Invalid credentials - no token provided', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        })
      });
    }

    console.log('WebDAV: Validating token:', token.substring(0, 8) + '...');

    const { data: tokenValidation, error: tokenError } = await supabase
      .rpc('validate_webdav_token', { token_text: token });

    console.log('WebDAV: Token validation result:', { tokenValidation, tokenError });

    if (tokenError || !tokenValidation || tokenValidation.length === 0 || !tokenValidation[0].is_valid) {
      console.error('WebDAV: Token validation failed:', tokenError);
      return new Response('Invalid or expired token', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        })
      });
    }

    const userInfo: UserInfo = {
      user_id: tokenValidation[0].user_id,
      token_id: tokenValidation[0].token_id,
      is_admin: false
    };

    console.log('WebDAV: User authenticated:', userInfo.user_id);

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
    const path = decodeURIComponent(url.pathname.replace('/functions/v1/webdav', '') || '/');
    console.log('WebDAV: Processing request for path:', path);

    switch (req.method) {
      case 'PROPFIND':
        return await handlePropfind(supabase, userInfo, path, req);
      case 'GET':
        return await handleGet(supabase, userInfo, path);
      case 'PUT':
        return await handlePut(supabase, userInfo, path, req);
      case 'DELETE':
        return await handleDelete(supabase, userInfo, path);
      case 'MKCOL':
        return await handleMkcol(supabase, userInfo, path);
      case 'MOVE':
        return await handleMove(supabase, userInfo, path, req);
      case 'COPY':
        return await handleCopy(supabase, userInfo, path, req);
      case 'LOCK':
        return await handleLock(supabase, userInfo, path, req);
      case 'UNLOCK':
        return await handleUnlock(supabase, userInfo, path, req);
      case 'PROPPATCH':
        return await handleProppatch(supabase, userInfo, path, req);
      default:
        console.log('WebDAV: Method not allowed:', req.method);
        return new Response('Method not allowed', {
          status: 405,
          headers: getWebDAVResponseHeaders()
        });
    }

  } catch (error) {
    console.error('WebDAV error:', error);
    return new Response('Internal server error: ' + error.message, {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});

async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('PROPFIND for path:', path, 'user:', userInfo.user_id);

  const depth = req.headers.get('Depth') || '1';
  
  try {
    if (path === '/' || path === '') {
      console.log('PROPFIND: Fetching accessible folders for user');
      const { data: folders, error } = await supabase
        .rpc('get_user_accessible_folders');

      if (error) {
        console.error('Error fetching folders:', error);
        return new Response('Internal server error: ' + error.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log('PROPFIND: Found', folders?.length || 0, 'accessible folders');

      userInfo.is_admin = folders && folders.length > 0;

      const folderItems = (folders || []).map((folder: AccessibleFolder) => `
        <D:response>
          <D:href>/functions/v1/webdav/${encodeURIComponent(folder.folder_name)}/</D:href>
          <D:propstat>
            <D:prop>
              <D:displayname>${folder.folder_name}</D:displayname>
              <D:resourcetype><D:collection/></D:resourcetype>
              <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
              <D:creationdate>${new Date().toISOString()}</D:creationdate>
              <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
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

      console.log('PROPFIND: Returning root directory with', (folders || []).length, 'folders');
      return new Response(response, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset="utf-8"'
        })
      });
    } else {
      const folderName = path.split('/').filter(p => p)[0];
      console.log('PROPFIND: Fetching folder contents for:', folderName);
      
      const { data: folders, error: foldersError } = await supabase
        .rpc('get_user_accessible_folders');

      if (foldersError) {
        console.error('Error fetching folders:', foldersError);
        return new Response('Internal server error: ' + foldersError.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      const folder = folders?.find((f: AccessibleFolder) => f.folder_name === folderName);
      if (!folder) {
        console.log('PROPFIND: Folder not found:', folderName);
        return new Response('Folder not found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }

      const { data: documents, error: docsError } = await supabase
        .rpc('get_user_accessible_documents', { folder_id_param: folder.folder_id });

      if (docsError) {
        console.error('Error fetching documents:', docsError);
        return new Response('Internal server error: ' + docsError.message, { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log('PROPFIND: Found', documents?.length || 0, 'documents in folder');

      const documentItems = (documents || []).map((doc: AccessibleDocument) => `
        <D:response>
          <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(doc.document_name)}</D:href>
          <D:propstat>
            <D:prop>
              <D:displayname>${doc.document_name}</D:displayname>
              <D:getcontentlength>${doc.file_size || 0}</D:getcontentlength>
              <D:getcontenttype>${doc.mime_type || 'application/octet-stream'}</D:getcontenttype>
              <D:creationdate>${new Date().toISOString()}</D:creationdate>
              <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
              <D:resourcetype/>
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
                <D:displayname>${folder.folder_name}</D:displayname>
                <D:resourcetype><D:collection/></D:resourcetype>
                <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
                <D:creationdate>${new Date().toISOString()}</D:creationdate>
                <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
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
    console.error('PROPFIND error:', error);
    return new Response('Internal server error: ' + error.message, { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handleGet(supabase: any, userInfo: UserInfo, path: string) {
  console.log('GET for path:', path, 'user:', userInfo.user_id);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    console.log('GET: Invalid path structure:', path);
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
      console.error('Error fetching documents:', error);
      return new Response('Internal server error: ' + error.message, { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const document = documents?.find((doc: AccessibleDocument) => 
      doc.document_name === fileName && doc.can_read
    );

    if (!document) {
      console.log('GET: File not found or not accessible:', fileName);
      return new Response('File not found', { 
        status: 404, 
        headers: getWebDAVResponseHeaders()
      });
    }

    console.log('GET: Redirecting to file URL:', document.file_url);
    return new Response(null, {
      status: 302,
      headers: getWebDAVResponseHeaders({
        'Location': document.file_url
      })
    });
  } catch (error) {
    console.error('GET error:', error);
    return new Response('Internal server error: ' + error.message, { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}

async function handlePut(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('PUT for path:', path);
  
  return new Response('File uploads not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleDelete(supabase: any, userInfo: UserInfo, path: string) {
  console.log('DELETE for path:', path);
  
  return new Response('File deletions not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleMkcol(supabase: any, userInfo: UserInfo, path: string) {
  console.log('MKCOL for path:', path);
  
  return new Response('Folder creation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleMove(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('MOVE for path:', path);
  
  return new Response('Move operation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleCopy(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('COPY for path:', path);
  
  return new Response('Copy operation not yet supported', {
    status: 405,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleLock(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('LOCK for path:', path);
  
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

async function handleUnlock(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('UNLOCK for path:', path);
  
  return new Response('', {
    status: 204,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleProppatch(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('PROPPATCH for path:', path);
  
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
