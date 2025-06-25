
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY',
  'DAV': '1, 2',
  'MS-Author-Via': 'DAV'
};

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
  console.log(`WebDAV ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Extract credentials from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      });
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.slice(6);
    const credentials = new TextDecoder().decode(
      Uint8Array.from(atob(base64Credentials), c => c.charCodeAt(0))
    );
    const [username, token] = credentials.split(':');

    if (!token) {
      return new Response('Invalid credentials', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      });
    }

    // Validate token using the enhanced function
    const { data: tokenValidation, error: tokenError } = await supabase
      .rpc('validate_webdav_token', { token_text: token });

    if (tokenError || !tokenValidation || tokenValidation.length === 0 || !tokenValidation[0].is_valid) {
      console.error('Token validation failed:', tokenError);
      return new Response('Invalid token', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="WebDAV"'
        }
      });
    }

    const userInfo: UserInfo = {
      user_id: tokenValidation[0].user_id,
      token_id: tokenValidation[0].token_id,
      is_admin: false // Will be determined by access functions
    };

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
    const path = decodeURIComponent(url.pathname.replace('/functions/v1/webdav', '') || '/');

    // Handle different WebDAV methods
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
      default:
        return new Response('Method not allowed', {
          status: 405,
          headers: {
            ...corsHeaders,
            'Allow': 'OPTIONS, PROPFIND, GET, PUT, DELETE, MKCOL, MOVE, COPY'
          }
        });
    }

  } catch (error) {
    console.error('WebDAV error:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    });
  }
});

async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('PROPFIND for path:', path);

  const depth = req.headers.get('Depth') || '1';
  
  try {
    if (path === '/' || path === '') {
      // Root directory - list accessible folders
      const { data: folders, error } = await supabase
        .rpc('get_user_accessible_folders');

      if (error) {
        console.error('Error fetching folders:', error);
        return new Response('Internal server error', { status: 500, headers: corsHeaders });
      }

      // Check if user is admin based on folder access
      userInfo.is_admin = folders.some((f: AccessibleFolder) => f.artist_id === null) || 
                         folders.length > 1; // Heuristic: admins typically see multiple folders

      const folderItems = folders.map((folder: AccessibleFolder) => `
        <D:response>
          <D:href>/functions/v1/webdav/${encodeURIComponent(folder.folder_name)}/</D:href>
          <D:propstat>
            <D:prop>
              <D:displayname>${folder.folder_name}</D:displayname>
              <D:resourcetype><D:collection/></D:resourcetype>
              <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
              <D:creationdate>${new Date().toISOString()}</D:creationdate>
              <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
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
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          ${folderItems}
        </D:multistatus>`;

      return new Response(response, {
        status: 207,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset="utf-8"'
        }
      });
    } else {
      // Specific folder - find the folder and list its contents
      const folderName = path.split('/').filter(p => p)[0];
      
      const { data: folders, error: foldersError } = await supabase
        .rpc('get_user_accessible_folders');

      if (foldersError) {
        console.error('Error fetching folders:', foldersError);
        return new Response('Internal server error', { status: 500, headers: corsHeaders });
      }

      const folder = folders.find((f: AccessibleFolder) => f.folder_name === folderName);
      if (!folder) {
        return new Response('Folder not found', { status: 404, headers: corsHeaders });
      }

      // Get documents in this folder
      const { data: documents, error: docsError } = await supabase
        .rpc('get_user_accessible_documents', { folder_id_param: folder.folder_id });

      if (docsError) {
        console.error('Error fetching documents:', docsError);
        return new Response('Internal server error', { status: 500, headers: corsHeaders });
      }

      const documentItems = documents.map((doc: AccessibleDocument) => `
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
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          ${documentItems}
        </D:multistatus>`;

      return new Response(response, {
        status: 207,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml; charset="utf-8"'
        }
      });
    }
  } catch (error) {
    console.error('PROPFIND error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}

async function handleGet(supabase: any, userInfo: UserInfo, path: string) {
  console.log('GET for path:', path);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Invalid path', { status: 404, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  try {
    // Get accessible documents
    const { data: documents, error } = await supabase
      .rpc('get_user_accessible_documents');

    if (error) {
      console.error('Error fetching documents:', error);
      return new Response('Internal server error', { status: 500, headers: corsHeaders });
    }

    const document = documents.find((doc: AccessibleDocument) => 
      doc.document_name === fileName && doc.can_read
    );

    if (!document) {
      return new Response('File not found', { status: 404, headers: corsHeaders });
    }

    // Redirect to the actual file URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': document.file_url
      }
    });
  } catch (error) {
    console.error('GET error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}

async function handlePut(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('PUT for path:', path);
  
  // For now, return method not allowed as file uploads need more complex handling
  return new Response('File uploads not yet supported', {
    status: 405,
    headers: corsHeaders
  });
}

async function handleDelete(supabase: any, userInfo: UserInfo, path: string) {
  console.log('DELETE for path:', path);
  
  // For now, return method not allowed as deletions need careful access control
  return new Response('File deletions not yet supported', {
    status: 405,
    headers: corsHeaders
  });
}

async function handleMkcol(supabase: any, userInfo: UserInfo, path: string) {
  console.log('MKCOL for path:', path);
  
  // For now, return method not allowed as folder creation needs proper access control
  return new Response('Folder creation not yet supported', {
    status: 405,
    headers: corsHeaders
  });
}

async function handleMove(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('MOVE for path:', path);
  
  return new Response('Move operation not yet supported', {
    status: 405,
    headers: corsHeaders
  });
}

async function handleCopy(supabase: any, userInfo: UserInfo, path: string, req: Request) {
  console.log('COPY for path:', path);
  
  return new Response('Copy operation not yet supported', {
    status: 405,
    headers: corsHeaders
  });
}
